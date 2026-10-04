import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = {};
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in env) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    env[match[1]] = value;
  }
}

const clientSecretName = /^VITE_(?:OPENROUTER|GEMINI|OPENAI|TAVILY)_.+KEY$|^VITE_CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)$|^VITE_SUPABASE_(?:SERVICE_ROLE_KEY|ACCESS_TOKEN)$/i;
const configuredValues = { ...env, ...process.env };
const forbiddenKeyNames = Object.keys(configuredValues).filter(
  (name) => clientSecretName.test(name) && configuredValues[name],
);
if (forbiddenKeyNames.length) {
  console.error(
    `Android build stopped: secret provider variables must not use VITE_ prefixes (${forbiddenKeyNames.join(", ")}).`,
  );
  process.exit(1);
}

const apiBase = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL;
let parsed;
try {
  parsed = new URL(apiBase);
} catch {
  console.error("Android build stopped: set VITE_API_BASE_URL to the deployed LORD HTTPS origin.");
  process.exit(1);
}
if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
  console.error(
    "Android build stopped: VITE_API_BASE_URL must be an HTTPS URL without credentials.",
  );
  process.exit(1);
}

if (process.argv.includes("--release")) {
  const signingVars = [
    "LORD_ANDROID_KEYSTORE_FILE",
    "LORD_ANDROID_KEYSTORE_PASSWORD",
    "LORD_ANDROID_KEY_ALIAS",
    "LORD_ANDROID_KEY_PASSWORD",
  ];
  const missing = signingVars.filter((name) => !process.env[name]);
  const keystorePath = process.env.LORD_ANDROID_KEYSTORE_FILE;
  if (missing.length || !keystorePath || !existsSync(keystorePath)) {
    console.error(
      `Release build stopped: configure a private Android keystore and all signing variables${missing.length ? ` (missing ${missing.join(", ")})` : ""}.`,
    );
    process.exit(1);
  }
}

console.info(
  "Android build configuration is valid; no provider secrets are exposed through VITE_ variables.",
);
