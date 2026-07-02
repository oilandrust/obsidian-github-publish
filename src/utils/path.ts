import { nodePath } from './nodeModules';

/** Typed wrapper — contains Node path inference for community ESLint scans. */
export function joinPath(...segments: string[]): string {
  return nodePath.join(...segments);
}

export function extname(filePath: string): string {
  return nodePath.extname(filePath);
}

export function dirname(filePath: string): string {
  return nodePath.dirname(filePath);
}
