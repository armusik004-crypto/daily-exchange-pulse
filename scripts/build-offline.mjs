// Packages the offline/APK bundle.
//
//   OFFLINE_APP=1 bun run build && node scripts/build-offline.mjs
//
// OFFLINE_APP=1 makes Vite prerender a static SPA shell at dist/client/index.html.
// This script copies dist/client to dist/offline-app, adds a Capacitor config,
// and zips everything into kandahar-rates-offline.zip.
import { mkdirSync, cpSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const CLIENT = "dist/client";
const OUT = "dist/offline-app";

if (!existsSync(join(CLIENT, "index.html"))) {
  console.error("Missing dist/client/index.html — run `OFFLINE_APP=1 bun run build` first.");
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(CLIENT, OUT, { recursive: true });

for (const f of readdirSync("dist")) {
  if (f === "sw.js" || /^workbox-.*\.js$/.test(f)) cpSync(join("dist", f), join(OUT, f));
}

writeFileSync(
  "dist/capacitor.config.json",
  JSON.stringify(
    {
      appId: "com.kandahar.rates",
      appName: "Kandahar Market Rates",
      webDir: "offline-app",
      android: { allowMixedContent: true },
    },
    null,
    2,
  ),
);

execSync("cd dist && zip -qr ../kandahar-rates-offline.zip offline-app capacitor.config.json");
console.log("Created kandahar-rates-offline.zip");
