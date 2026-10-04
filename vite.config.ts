import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Locally we build a self-contained Node server + static client into `dist/`
// (nitro disabled), so `npm run dev` / `npm run build` / `npm run preview`
// all work out of the box. On Vercel, set NITRO_PRESET=vercel (see vercel.json)
// so the build emits a Vercel Build Output API (`.vercel/output`) with a
// Node.js serverless function for SSR + the /api/chat route.
const nitroPreset = process.env.NITRO_PRESET;
const requestedPort = Number(
  process.env.PORT ?? process.env.VITE_PORT ?? process.env.SERVER_PORT ?? 8080,
);
const localPort = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 8080;
// The code tool uses TypeScript's CommonJS compiler API at runtime. Tell Nitro
// to leave it as a Node dependency and trace it into Vercel's function bundle.
// Keep this in a variable because the Lovable config wrapper's public type only
// exposes a subset of Nitro's supported options.
const nitroOptions = nitroPreset ? { preset: nitroPreset, traceDeps: ["typescript"] } : false;

export default defineConfig({
  // Only Android packages the client as local assets; keep normal web SSR
  // behavior unchanged.
  ...(process.env.LORD_ANDROID_BUILD === "1"
    ? {
        tanstackStart: {
          spa: {
            enabled: true,
            maskPath: "/",
            prerender: {
              outputPath: "/index",
              crawlLinks: false,
            },
          },
        },
      }
    : {}),
  vite: {
    base: "/",
    // TanStack Start serves the client, SSR, and file-route APIs from this one
    // server. strictPort prevents Vite from silently switching to another port.
    server: { host: "0.0.0.0", port: localPort, strictPort: true },
    preview: { host: "0.0.0.0", port: localPort, strictPort: true },
  },
  nitro: nitroOptions,
});
