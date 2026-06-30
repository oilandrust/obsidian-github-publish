import { TAbstractFile, TFile, TFolder, Vault } from 'obsidian';

export function getVaultFolder(vault: Vault, folderPath: string): TFolder {
  const folder = vault.getAbstractFileByPath(folderPath);
  if (!(folder instanceof TFolder)) {
    throw new Error(`Folder not found: ${folderPath}`);
  }
  return folder;
}

export function getVaultRootFolder(vault: Vault): TFolder {
  return vault.getRoot();
}

export function asFolder(file: TAbstractFile): TFolder | null {
  return file instanceof TFolder ? file : null;
}

export function asFile(file: TAbstractFile): TFile | null {
  return file instanceof TFile ? file : null;
}

export async function readVaultBinary(vault: Vault, file: TFile): Promise<Uint8Array> {
  const arrayBuffer = (await vault.readBinary(file)) as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
}
