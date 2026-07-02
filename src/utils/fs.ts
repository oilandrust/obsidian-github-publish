import * as fs from 'fs';
import * as zlib from 'zlib';

function asString(value: unknown): string {
  return value as string;
}

function asBoolean(value: unknown): boolean {
  return value as boolean;
}

function asUint8Array(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new Error('Expected binary file contents');
  }
  return value;
}

export function readTextFile(path: string): string {
  const data: unknown = fs.readFileSync(path, 'utf8');
  return asString(data);
}

export function readBytesFile(path: string): Uint8Array {
  const data: unknown = fs.readFileSync(path);
  return asUint8Array(data);
}

export function fileExists(path: string): boolean {
  const exists: unknown = fs.existsSync(path);
  return asBoolean(exists);
}

export function ensureDirSync(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeTextFileSync(path: string, content: string): void {
  fs.writeFileSync(path, content, 'utf8');
}

export function writeBytesFileSync(path: string, content: Uint8Array): void {
  fs.writeFileSync(path, content);
}

export function decodeBase64(encoded: string): Uint8Array {
  const binary = globalThis.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function gunzipToUtf8(data: Uint8Array): string {
  const decompressed: unknown = zlib.gunzipSync(data);
  return new TextDecoder().decode(asUint8Array(decompressed));
}
