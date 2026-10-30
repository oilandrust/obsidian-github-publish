import { TAbstractFile, TFile, TFolder, Vault } from 'obsidian';

function asArrayBuffer(value: unknown): ArrayBuffer {
  return value as ArrayBuffer;
}

export function getVaultFolder(vault: Vault, folderPath: string): TFolder {
  const folder: unknown = vault.getAbstractFileByPath(folderPath);
  if (!(folder instanceof TFolder)) {
    throw new Error(`Folder not found: ${folderPath}`);
  }
  return folder;
}

export function getVaultRootFolder(vault: Vault): TFolder {
  return vault.getRoot();
}

/** Vault root is stored as "". Obsidian's root folder path is "/". */
export function normalizeContentFolder(folderPath: string): string {
  const trimmed = folderPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (trimmed === '' || trimmed === '/') {
    return '';
  }
  return trimmed;
}

export function isContentFolderSet(
  folderPath: string | null | undefined,
): folderPath is string {
  return folderPath != null;
}

export function formatContentFolder(folderPath: string | null | undefined): string {
  if (!isContentFolderSet(folderPath)) {
    return '';
  }
  return normalizeContentFolder(folderPath) || '(vault root)';
}

export function resolveVaultFolder(vault: Vault, folderPath: string): TFolder {
  if (normalizeContentFolder(folderPath) === '') {
    return getVaultRootFolder(vault);
  }
  return getVaultFolder(vault, normalizeContentFolder(folderPath));
}

/** Path prefix stripped from vault paths when publishing this folder. Root is "". */
export function contentScanRoot(folder: TFolder): string {
  return folder.isRoot() ? '' : folder.path;
}

export function asFolder(file: TAbstractFile): TFolder | null {
  return file instanceof TFolder ? file : null;
}

export function asFile(file: TAbstractFile): TFile | null {
  return file instanceof TFile ? file : null;
}

export async function readVaultBinary(vault: Vault, file: TFile): Promise<Uint8Array> {
  const arrayBuffer = asArrayBuffer(await vault.readBinary(file));
  return new Uint8Array(arrayBuffer);
}
