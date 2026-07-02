import { TAbstractFile, TFolder, Vault } from 'obsidian';
import { RepoFile } from '../settings';
import {
  asFile,
  getVaultFolder,
  getVaultRootFolder,
  readVaultBinary,
} from '../utils/vault';

const EXCLUDED_DIR_NAMES = new Set(['.git', 'node_modules']);
const EXCLUDED_FILES = new Set(['.DS_Store']);
const SKIPPED_EXTENSIONS = new Set(['.canvas']);

const INCLUDED_EXTENSIONS = new Set([
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.pdf',
  '.mp3',
]);

export interface ScanResult {
  files: RepoFile[];
  warnings: string[];
}

function configDirFolderName(vault: Vault): string {
  const normalized = vault.configDir.replace(/\\/g, '/').replace(/\/$/, '');
  const segment = normalized.split('/').filter(Boolean).pop();
  return segment ?? '.obsidian';
}

function shouldExcludeDir(vault: Vault, dirName: string): boolean {
  if (EXCLUDED_DIR_NAMES.has(dirName)) {
    return true;
  }
  return dirName === configDirFolderName(vault);
}

export async function scanVaultFolder(vault: Vault, folderPath: string): Promise<ScanResult> {
  const folder = getVaultFolder(vault, folderPath);

  const files: RepoFile[] = [];
  const warnings: string[] = [];

  await walkFolder(vault, folder, folderPath, files, warnings);

  return { files, warnings };
}

async function walkFolder(
  vault: Vault,
  folder: TFolder,
  rootPath: string,
  files: RepoFile[],
  warnings: string[],
): Promise<void> {
  for (const child of folder.children) {
    if (child instanceof TFolder) {
      if (shouldExcludeDir(vault, child.name)) continue;
      await walkFolder(vault, child, rootPath, files, warnings);
      continue;
    }

    const file = asFile(child);
    if (!file) continue;

    const relative = file.path.slice(rootPath.length).replace(/^\//, '');
    const skip = shouldSkip(relative);
    if (skip === true) continue;
    if (typeof skip === 'string') {
      warnings.push(skip);
      continue;
    }

    const repoPath = `content/${file.path.slice(rootPath.length).replace(/^\//, '')}`;
    const content = await readVaultBinary(vault, file);
    const ext: string = file.extension.toLowerCase();
    const encoding: 'utf-8' | 'base64' = ext === 'md' ? 'utf-8' : 'base64';

    files.push({ path: repoPath, content, encoding });
  }
}

function shouldSkip(relativePath: string): true | string | false {
  const basename = relativePath.split('/').pop() ?? relativePath;
  if (EXCLUDED_FILES.has(basename)) return true;

  const ext = '.' + (basename.split('.').pop()?.toLowerCase() ?? '');
  if (SKIPPED_EXTENSIONS.has(ext)) return true;
  if (relativePath.toLowerCase().endsWith('.excalidraw.md')) {
    return `Skipping Excalidraw note: ${relativePath}`;
  }

  const fileExt = '.' + (basename.includes('.') ? basename.split('.').pop()?.toLowerCase() : '');
  if (!INCLUDED_EXTENSIONS.has(fileExt)) return true;

  return false;
}

export function countFilesInFolder(vault: Vault, folderPath: string): number {
  const folder = folderPath === '' ? getVaultRootFolder(vault) : getVaultFolder(vault, folderPath);

  let count = 0;
  const walk = (node: TAbstractFile) => {
    if (node instanceof TFolder) {
      if (shouldExcludeDir(vault, node.name)) return;
      node.children.forEach(walk);
      return;
    }
    const file = asFile(node);
    if (!file) return;
    const relative = file.path.slice(folderPath.length).replace(/^\//, '');
    if (shouldSkip(relative) === false) count++;
  };
  walk(folder);
  return count;
}
