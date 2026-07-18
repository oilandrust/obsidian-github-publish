import esbuild from 'esbuild';
import { builtinModules } from 'node:module';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prod = process.argv[2] === 'production';
const showAdvancedSettings = process.env.PLUGIN_SHOW_ADVANCED_SETTINGS === 'true';

function getBuildCommit() {
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      cwd: __dirname,
      encoding: 'utf8',
    }).trim();
    const dirty = execSync('git status --porcelain', {
      cwd: __dirname,
      encoding: 'utf8',
    }).trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

const buildCommit = getBuildCommit();

if (prod) {
  execSync('node scripts/embed-assets.mjs', { cwd: __dirname, stdio: 'inherit' });
}

const context = await esbuild.context({
  entryPoints: ['main.ts'],
  bundle: true,
  define: {
    __SHOW_ADVANCED_SETTINGS__: String(showAdvancedSettings),
    __IS_DEV_BUILD__: String(!prod),
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtinModules,
  ],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
