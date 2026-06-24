import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { parseAllNotes, copyAssets } from './lib/parse-markdown.mjs';
import {
  buildSiteTree,
  listAssets,
  listNotes,
  scanContent,
} from './lib/scan-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(ROOT_DIR, 'template');
const DATA_DIR = path.join(TEMPLATE_DIR, 'public', 'data');
const ASSETS_DIR = path.join(TEMPLATE_DIR, 'public', 'assets');
const SITE_DATA_PATH = path.join(DATA_DIR, 'site-data.json');

function parseArgs(argv) {
  const options = {
    content: null,
    siteName: 'Published Vault',
    basePath: '/',
    skipVite: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--content') {
      options.content = argv[++i];
    } else if (arg === '--site-name') {
      options.siteName = argv[++i];
    } else if (arg === '--base-path') {
      options.basePath = argv[++i];
    } else if (arg === '--skip-vite') {
      options.skipVite = true;
    }
  }

  if (!options.content) {
    console.error('Usage: node scripts/build-site.mjs --content <vault-path> [--site-name "Name"] [--base-path /repo/] [--skip-vite]');
    process.exit(1);
  }

  if (!options.basePath.endsWith('/')) {
    options.basePath += '/';
  }

  return options;
}

function cleanGeneratedDirs() {
  fs.rmSync(ASSETS_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function runViteBuild(basePath) {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: TEMPLATE_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_BASE_PATH: basePath,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const warnings = [];

  console.log(`Building site from: ${options.content}`);
  cleanGeneratedDirs();

  const scanResult = scanContent(options.content);
  warnings.push(...scanResult.warnings);

  const notePaths = listNotes(scanResult.entries);
  const assetPaths = listAssets(scanResult.entries).map((asset) => asset.path);

  const noteHtmlByPath = parseAllNotes(
    notePaths,
    scanResult.contentDir,
    scanResult.allFiles,
    warnings,
  );

  copyAssets(assetPaths, scanResult.contentDir, ASSETS_DIR);

  const siteData = {
    siteName: options.siteName,
    basePath: options.basePath,
    tree: buildSiteTree(scanResult.entries, noteHtmlByPath),
  };

  fs.writeFileSync(SITE_DATA_PATH, JSON.stringify(siteData, null, 2));

  console.log(`Wrote ${notePaths.length} notes, ${assetPaths.length} assets`);
  if (warnings.length > 0) {
    console.warn('\nWarnings:');
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (!options.skipVite) {
    console.log('\nRunning Vite build...');
    runViteBuild(options.basePath);
    console.log(`\nDone. Output: ${path.join(ROOT_DIR, 'dist')}`);
  } else {
    console.log('\nSkipped Vite build (--skip-vite).');
  }
}

main();
