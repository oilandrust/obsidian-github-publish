import * as nodePath from 'path';

function asString(value: unknown): string {
  return value as string;
}

/** Typed wrapper — contains Node path inference for community ESLint scans. */
export function joinPath(...segments: string[]): string {
  const result: unknown = nodePath.join(...segments);
  return asString(result);
}

export function extname(filePath: string): string {
  const result: unknown = nodePath.extname(filePath);
  return asString(result);
}

export function dirname(filePath: string): string {
  const result: unknown = nodePath.dirname(filePath);
  return asString(result);
}
