import { App, FileSystemAdapter, normalizePath } from 'obsidian';
import { callBound, callFn } from './call';

export function getVaultBasePath(app: App): string {
  const adapter = app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) {
    throw new Error('GitHub Publish requires the desktop app.');
  }
  const basePath: unknown = callBound(adapter, 'getBasePath');
  return basePath as string;
}

export function joinNormalizedPath(...parts: string[]): string {
  const joined = parts.join('/').replace(/\\/g, '/');
  const normalized: unknown = callFn(normalizePath, joined);
  return normalized as string;
}
