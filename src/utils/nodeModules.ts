import * as fsImport from 'fs';
import * as nodePathImport from 'path';
import * as zlibImport from 'zlib';

interface NodeFs {
  readFileSync(path: string, encoding: 'utf8'): string;
  readFileSync(path: string): Uint8Array;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: boolean }): void;
  writeFileSync(path: string, content: string, encoding: 'utf8'): void;
  writeFileSync(path: string, content: Uint8Array): void;
}

interface NodePath {
  join(...segments: string[]): string;
  extname(filePath: string): string;
  dirname(filePath: string): string;
}

interface NodeZlib {
  gunzipSync(data: Uint8Array): Uint8Array;
}

/** Typed Node built-ins — contains module inference for community ESLint scans. */
export const nodeFs = fsImport as unknown as NodeFs;
export const nodePath = nodePathImport as unknown as NodePath;
export const nodeZlib = zlibImport as unknown as NodeZlib;
