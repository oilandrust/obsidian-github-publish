import * as fs from 'fs';

function asString(value: unknown): string {
  return value as string;
}

function asBuffer(value: unknown): Buffer {
  return value as Buffer;
}

function asBoolean(value: unknown): boolean {
  return value as boolean;
}

export function readTextFile(path: string): string {
  const data: unknown = fs.readFileSync(path, 'utf8');
  return asString(data);
}

export function readBytesFile(path: string): Buffer {
  const data: unknown = fs.readFileSync(path);
  return asBuffer(data);
}

export function fileExists(path: string): boolean {
  const exists: unknown = fs.existsSync(path);
  return asBoolean(exists);
}
