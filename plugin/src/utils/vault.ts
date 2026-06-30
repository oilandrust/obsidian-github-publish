import { TAbstractFile, TFile, TFolder, Vault } from 'obsidian';
import { callBound } from './call';

function asArrayBuffer(value: unknown): ArrayBuffer {
  return value as ArrayBuffer;
}

export function getVaultFolder(vault: Vault, folderPath: string): TFolder {
  const folder: unknown = callBound(vault, 'getAbstractFileByPath', folderPath);
  if (!(folder instanceof TFolder)) {
    throw new Error(`Folder not found: ${folderPath}`);
  }
  return folder;
}

export function getVaultRootFolder(vault: Vault): TFolder {
  const root: unknown = callBound(vault, 'getRoot');
  if (!(root instanceof TFolder)) {
    throw new Error('Vault root is not a folder');
  }
  return root;
}

export function getOptionalVaultFolder(vault: Vault, folderPath: string): TFolder | null {
  if (folderPath === '') {
    return getVaultRootFolder(vault);
  }
  const file: unknown = callBound(vault, 'getAbstractFileByPath', folderPath);
  return file instanceof TFolder ? file : null;
}

export function getFolderChildren(folder: TFolder): TAbstractFile[] {
  const raw: unknown = folder.children;
  return raw as TAbstractFile[];
}

export function vaultFilePath(file: TFile): string {
  const path: unknown = file.path;
  return path as string;
}

export function vaultFileExtension(file: TFile): string {
  const ext: unknown = file.extension;
  return (ext as string).toLowerCase();
}

export function listSubfolders(folder: TFolder): TFolder[] {
  const children: TFolder[] = [];
  for (const child of getFolderChildren(folder)) {
    const subfolder = asFolder(child);
    if (subfolder) {
      children.push(subfolder);
    }
  }
  return children;
}

export function listSubfoldersSorted(folder: TFolder): TFolder[] {
  return listSubfolders(folder).sort(
    (a, b): number => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

export function asFolder(file: TAbstractFile): TFolder | null {
  return file instanceof TFolder ? file : null;
}

export function asFile(file: TAbstractFile): TFile | null {
  return file instanceof TFile ? file : null;
}

export async function readVaultBinary(vault: Vault, file: TFile): Promise<Uint8Array> {
  const raw: unknown = await callBound(vault, 'readBinary', file);
  const arrayBuffer = asArrayBuffer(raw);
  return new Uint8Array(arrayBuffer);
}
