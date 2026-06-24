import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'plugin', 'assets', 'toolchain');

const COPY_DIRS = [
  { from: 'scripts', to: 'scripts' },
  { from: path.join('template', 'src'), to: path.join('template', 'src') },
];

const COPY_FILES = [
  { from: 'package-lock.json', to: 'package-lock.json' },
  { from: path.join('template', 'package-lock.json'), to: path.join('template', 'package-lock.json') },
  { from: path.join('template', 'index.html'), to: path.join('template', 'index.html') },
  { from: path.join('template', 'package.json'), to: path.join('template', 'package.json') },
  { from: path.join('template', 'vite.config.ts'), to: path.join('template', 'vite.config.ts') },
  { from: path.join('template', 'tsconfig.json'), to: path.join('template', 'tsconfig.json') },
  { from: path.join('template', 'tsconfig.node.json'), to: path.join('template', 'tsconfig.node.json') },
];

const GITIGNORE = `node_modules/
template/node_modules/
dist/
template/public/data/site-data.json
template/public/assets/
.DS_Store
`;

const PACKAGE_TEMPLATE = `{
  "name": "{{repo}}",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-site.mjs --content ./content --site-name \\"{{siteName}}\\" --base-path /{{repo}}/",
    "dev": "node scripts/build-site.mjs --content ./content --site-name \\"{{siteName}}\\" --base-path / --skip-vite && npm run dev --prefix template",
    "preview": "npm run preview --prefix template"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "marked": "^15.0.7"
  }
}
`;

const DEPLOY_YML = `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: |
            package-lock.json
            template/package-lock.json

      - run: npm ci
      - run: npm ci --prefix template
      - run: npm run build

      - uses: actions/configure-pages@v4

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`;

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });

for (const { from, to } of COPY_DIRS) {
  copyDir(path.join(ROOT, from), path.join(OUT, to));
}

for (const { from, to } of COPY_FILES) {
  const src = path.join(ROOT, from);
  const dest = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

fs.writeFileSync(path.join(OUT, '.gitignore'), GITIGNORE);
fs.writeFileSync(path.join(OUT, 'package.json.template'), PACKAGE_TEMPLATE);
fs.mkdirSync(path.join(OUT, '.github', 'workflows'), { recursive: true });
fs.writeFileSync(path.join(OUT, '.github', 'workflows', 'deploy.yml'), DEPLOY_YML);

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

console.log(`Synced toolchain to ${OUT} (${manifest.length} files)`);
