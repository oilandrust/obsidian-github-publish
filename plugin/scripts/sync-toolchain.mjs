import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets', 'toolchain-inhouse');

const manifest = [];
function walkManifest(dir, relative = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkManifest(full, rel);
    } else if (entry.name !== 'manifest.json') {
      manifest.push(rel);
    }
  }
}
walkManifest(OUT);
fs.writeFileSync(
  path.join(OUT, 'manifest.json'),
  JSON.stringify(manifest.sort(), null, 2),
);

console.log(`Regenerated in-house toolchain manifest (${manifest.length} files)`);
