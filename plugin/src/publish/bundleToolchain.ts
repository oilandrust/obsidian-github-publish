import * as fs from 'fs';
import * as path from 'path';
import { RepoFile } from '../settings';

interface ToolchainManifest {
  files?: string[];
}

export function loadToolchainFiles(pluginDir: string, siteName: string, repoName: string): RepoFile[] {
  const toolchainDir = path.join(pluginDir, 'assets', 'toolchain');
  const manifestPath = path.join(toolchainDir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      'Toolchain not found. Run npm run sync:toolchain in the obsidian-github-publish repo.',
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ToolchainManifest | string[];
  const filePaths = Array.isArray(manifest) ? manifest : manifest.files ?? [];
  const files: RepoFile[] = [];

  for (const relativePath of filePaths) {
    if (relativePath === 'package.json.template') continue;

    const absolute = path.join(toolchainDir, relativePath);
    const content = fs.readFileSync(absolute);
    const isText =
      relativePath.endsWith('.md') ||
      relativePath.endsWith('.mjs') ||
      relativePath.endsWith('.ts') ||
      relativePath.endsWith('.tsx') ||
      relativePath.endsWith('.json') ||
      relativePath.endsWith('.yml') ||
      relativePath.endsWith('.yaml') ||
      relativePath.endsWith('.html') ||
      relativePath.endsWith('.css') ||
      relativePath.endsWith('.gitignore');

    files.push({
      path: relativePath,
      content,
      encoding: isText ? 'utf-8' : 'base64',
    });
  }

  const packageTemplate = fs.readFileSync(path.join(toolchainDir, 'package.json.template'), 'utf8');
  const packageJson = packageTemplate
    .replaceAll('{{siteName}}', siteName)
    .replaceAll('{{repo}}', repoName);

  files.push({
    path: 'package.json',
    content: new TextEncoder().encode(packageJson),
    encoding: 'utf-8',
  });

  return files;
}
