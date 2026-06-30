import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'plugin', 'assets', 'toolchain-quartz');
const DEFAULT_QUARTZ_COMMIT =
  process.env.QUARTZ_COMMIT_SHA ?? '9cf87ff1c248a8ca551093214b0fec3b31415009';

const GITIGNORE = `node_modules/
.quartz/
public/
.DS_Store
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
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v5
        with:
          node-version: '22'

      - name: Clone Quartz engine
        run: |
          git clone --depth 1 https://github.com/jackyzha0/quartz.git quartz-engine
          cd quartz-engine
          git fetch --depth 1 origin {{quartzCommitSha}}
          git checkout {{quartzCommitSha}}

      - name: Restore Quartz dependency cache
        uses: actions/cache@v4
        id: quartz-deps-cache
        with:
          path: |
            quartz-engine/node_modules
            quartz-engine/.quartz/plugins
          key: quartz-deps-{{quartzCommitSha}}-\${{ hashFiles('quartz.lock.json') }}
          restore-keys: |
            quartz-deps-{{quartzCommitSha}}-

      - name: Overlay user site
        run: |
          rm -rf quartz-engine/content
          cp -r content quartz-engine/content
          cp quartz.config.yaml quartz.lock.json quartz-engine/

      - name: Install dependencies
        if: steps.quartz-deps-cache.outputs.cache-hit != 'true'
        working-directory: quartz-engine
        run: npm ci

      - name: Install Quartz plugins
        if: steps.quartz-deps-cache.outputs.cache-hit != 'true'
        working-directory: quartz-engine
        run: npx quartz plugin install

      - name: Build site
        working-directory: quartz-engine
        run: npx quartz build

      - uses: actions/upload-pages-artifact@v5
        with:
          path: quartz-engine/public

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
`;

const SITE_JSON_TEMPLATE = `{
  "templateEngine": "quartz",
  "quartzCommitSha": "{{quartzCommitSha}}",
  "siteName": "{{siteName}}",
  "owner": "{{owner}}",
  "repo": "{{repo}}"
}
`;

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function templateQuartzConfig(yaml) {
  let result = yaml
    .replace(/^(\s*pageTitle:\s*).+$/m, '$1{{pageTitle}}')
    .replace(/^(\s*baseUrl:\s*).+$/m, '$1{{baseUrl}}');

  // GitHub Pages serves index.xml before index.html; keep RSS off the root slug.
  if (!result.includes('rssSlug:')) {
    result = result.replace(
      /(  - source: github:quartz-community\/content-index\n    enabled: true\n    options:\n      enableSiteMap: true\n      enableRSS: true)/,
      '$1\n      rssSlug: feed',
    );
  }

  return result;
}

console.log(`Syncing Quartz toolchain (commit ${DEFAULT_QUARTZ_COMMIT})…`);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quartz-sync-'));
const quartzDir = path.join(workDir, 'quartz');

try {
  run(`git clone --depth 1 --branch v5 https://github.com/jackyzha0/quartz.git quartz`, workDir);
  run(`git fetch --depth 1 origin ${DEFAULT_QUARTZ_COMMIT}`, quartzDir);
  run(`git checkout ${DEFAULT_QUARTZ_COMMIT}`, quartzDir);
  run('npm ci', quartzDir);
  run(
    'npx quartz create --template obsidian --strategy new --source content --baseUrl example.github.io/example',
    quartzDir,
  );

  const quartzConfig = templateQuartzConfig(
    fs.readFileSync(path.join(quartzDir, 'quartz.config.yaml'), 'utf8'),
  );
  const quartzLock = fs.readFileSync(path.join(quartzDir, 'quartz.lock.json'), 'utf8');

  rmrf(OUT);
  fs.mkdirSync(path.join(OUT, '.github', 'workflows'), { recursive: true });
  fs.mkdirSync(path.join(OUT, '.github-publish'), { recursive: true });

  fs.writeFileSync(path.join(OUT, '.gitignore'), GITIGNORE);
  fs.writeFileSync(path.join(OUT, 'quartz.config.yaml'), quartzConfig);
  fs.writeFileSync(path.join(OUT, 'quartz.lock.json'), quartzLock);
  fs.writeFileSync(path.join(OUT, '.github', 'workflows', 'deploy.yml'), DEPLOY_YML);
  fs.writeFileSync(path.join(OUT, '.github-publish', 'site.json.template'), SITE_JSON_TEMPLATE);

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

  console.log(`Synced Quartz toolchain to ${OUT} (${manifest.length} files)`);
} finally {
  rmrf(workDir);
}
