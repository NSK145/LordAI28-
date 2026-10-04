import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const env = { ...process.env };
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || env[match[1]]) continue;
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

const secretNames = [
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "TAVILY_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
];
const secrets = secretNames
  .map((name) => [name, env[name]?.trim()])
  .filter((entry) => entry[1]?.length >= 16);

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

const output = resolve("dist/client");
if (!existsSync(output)) {
  console.error("Client secret scan failed: build output dist/client does not exist.");
  process.exit(1);
}
const files = collectFiles(output);
const leaked = new Set();
for (const file of files) {
  const content = readFileSync(file);
  for (const [name, value] of secrets) {
    if (content.includes(value)) leaked.add(name);
  }
}
if (leaked.size) {
  console.error(`Client build contains configured server secret(s): ${[...leaked].join(", ")}.`);
  process.exit(1);
}
console.info("Client build secret scan passed.");
