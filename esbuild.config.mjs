import esbuild from 'esbuild';
import builtinModules from 'builtin-modules';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prod = process.argv[2] === 'production';
const showAdvancedSettings = process.env.PLUGIN_SHOW_ADVANCED_SETTINGS === 'true';

if (prod) {
  execSync('node scripts/embed-assets.mjs', { cwd: __dirname, stdio: 'inherit' });
}

const context = await esbuild.context({
  entryPoints: ['main.ts'],
  bundle: true,
  define: {
    __SHOW_ADVANCED_SETTINGS__: String(showAdvancedSettings),
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
