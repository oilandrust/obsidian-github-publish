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

const INCLUDED_EXTENSIONS = new Set([
  '.md',
  '.canvas',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.pdf',
  '.mp3',
]);

const TEXT_EXTENSIONS = new Set(['md', 'canvas']);

interface CanvasNode {
  id: string;
  type: string;
  file?: string;
  subpath?: string;
  [key: string]: any;
}

interface CanvasData {
  nodes?: CanvasNode[];
  edges?: any[];
  [key: string]: any;
}

function transformCanvasForPublish(content: Uint8Array): Uint8Array {
  try {
    const text = new TextDecoder('utf-8').decode(content);
    const canvas: CanvasData = JSON.parse(text);

    if (canvas.nodes) {
      canvas.nodes = canvas.nodes.map((node) => {
        if (node.type === 'file' && node.file) {
          const filePath = node.file;
          const hasSubpath = node.subpath !== undefined;
          
          if (!filePath.match(/\.(md|png|jpg|jpeg|gif|webp|pdf|mp3|canvas)$/i)) {
            node.file = filePath + '.md';
          }
        }
        return node;
      });
    }

    const transformed = JSON.stringify(canvas, null, 2);
    return new TextEncoder().encode(transformed);
  } catch (error) {
    return content;
  }
}

export interface ScanResult {
  files: RepoFile[];
  warnings: string[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/$/, '');
}

function isConfigDir(vault: Vault, folder: TFolder): boolean {
  return normalizePath(folder.path) === normalizePath(vault.configDir);
}

function shouldExcludeDir(vault: Vault, folder: TFolder): boolean {
  if (EXCLUDED_DIR_NAMES.has(folder.name)) {
    return true;
  }
  return isConfigDir(vault, folder);
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
      if (shouldExcludeDir(vault, child)) continue;
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
    let content = await readVaultBinary(vault, file);
    const ext: string = file.extension.toLowerCase();
    const encoding: 'utf-8' | 'base64' = TEXT_EXTENSIONS.has(ext) ? 'utf-8' : 'base64';

    if (ext === 'canvas') {
      content = transformCanvasForPublish(content);
    }

    files.push({ path: repoPath, content, encoding });
  }
}

function shouldSkip(relativePath: string): true | string | false {
  const basename = relativePath.split('/').pop() ?? relativePath;
  if (EXCLUDED_FILES.has(basename)) return true;

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
      if (shouldExcludeDir(vault, node)) return;
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
