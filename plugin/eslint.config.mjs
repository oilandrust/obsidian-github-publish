import tsParser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

const pluginTsFiles = ['**/*.ts'];
const inhouseTemplateFiles = ['assets/toolchain-inhouse/template/src/**/*.{ts,tsx}'];

export default [
  {
    ignores: [
      '**/node_modules/**',
      'main.js',
      '**/*.mjs',
      'assets/toolchain-quartz/**',
      'package.json',
      'assets/toolchain-inhouse/template/vite.config.ts',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: [...pluginTsFiles, ...inhouseTemplateFiles],
  })),
  {
    files: pluginTsFiles,
    plugins: { obsidianmd },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    rules: {
      ...(obsidianmd.configs.recommended[0]?.rules ?? {}),
      ...(obsidianmd.configs.recommended[16]?.rules ?? {}),
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: inhouseTemplateFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './assets/toolchain-inhouse/template/tsconfig.json',
        sourceType: 'module',
      },
    },
    rules: {
      'no-restricted-globals': 'off',
    },
  },
];
