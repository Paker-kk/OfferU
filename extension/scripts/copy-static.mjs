// Build helper: copy static files to dist/
import { cpSync, mkdirSync, existsSync, copyFileSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

const statics = ["manifest.json", "popup.html", "popup.css"];
for (const f of statics) {
  copyFileSync(resolve(root, "static", f), resolve(dist, f));
}

// Copy icons
const iconsDir = resolve(root, "static", "icons");
if (existsSync(iconsDir)) {
  const distIconsDir = resolve(dist, "icons");
  if (existsSync(distIconsDir)) {
    rmSync(distIconsDir, { recursive: true, force: true });
  }
  cpSync(iconsDir, distIconsDir, { recursive: true });
}

console.log("✅ Static files copied to dist/");
