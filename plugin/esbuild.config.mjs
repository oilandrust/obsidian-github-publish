import esbuild from 'esbuild';
import builtinModules from 'builtin-modules';
import fs from 'fs';
import path from 'path';

const prod = process.argv[2] === 'production';
const showAdvancedSettings = process.env.PLUGIN_SHOW_ADVANCED_SETTINGS === 'true';

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
