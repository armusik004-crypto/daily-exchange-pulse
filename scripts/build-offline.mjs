// Builds an offline-capable static bundle (dist/offline-app) that can be
// wrapped into an Android APK with Capacitor, and zips it for download.
//
//   bun run build && node scripts/build-offline.mjs
//
import { readdirSync, mkdirSync, cpSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const CLIENT = "dist/client";
const OUT = "dist/offline-app";

if (!existsSync(join(CLIENT, "assets"))) {
  console.error("Run `bun run build` first — dist/client/assets is missing.");
  process.exit(1);
}

const assets = readdirSync(join(CLIENT, "assets"));
const entry = assets.find((f) => /^index-.*\.js$/.test(f));
const css = assets.find((f) => /\.css$/.test(f));
if (!entry) {
  console.error("Could not find the client entry chunk in dist/client/assets.");
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(CLIENT, OUT, { recursive: true });
for (const f of ["dist/sw.js", ...readdirSync("dist").filter((f) => /^workbox-.*\.js$/.test(f)).map((f) => `dist/${f}`)]) {
  if (existsSync(f)) cpSync(f, join(OUT, f.replace(/^dist\//, "")));
}

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#059669" />
    <title>Kandahar Market Rates</title>
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icon-512.png" type="image/png" />
    <link rel="apple-touch-icon" href="/icon-512.png" />
    ${css ? `<link rel="stylesheet" href="/assets/${css}" />` : ""}
  </head>
  <body>
    <script type="module" src="/assets/${entry}"></script>
  </body>
</html>
`;
writeFileSync(join(OUT, "index.html"), html);

writeFileSync(
  join(OUT, "..", "capacitor.config.json"),
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

execSync(`cd dist && zip -qr ../kandahar-rates-offline.zip offline-app capacitor.config.json`);
console.log("Created kandahar-rates-offline.zip");
