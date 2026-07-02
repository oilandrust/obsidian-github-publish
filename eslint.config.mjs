import tsParser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

const pluginTsFiles = ['**/*.ts'];

export default [
  {
    ignores: [
      '**/node_modules/**',
      'main.js',
      '**/*.mjs',
      'assets/toolchain-quartz/**',
      'package.json',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: pluginTsFiles,
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
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
    },
  },
];
