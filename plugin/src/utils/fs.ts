import * as fs from 'fs';

export function readTextFile(path: string): string {
  return fs.readFileSync(path, 'utf8') as string;
}

export function readBytesFile(path: string): Buffer {
  return fs.readFileSync(path) as Buffer;
}

export function fileExists(path: string): boolean {
  return fs.existsSync(path) as boolean;
}
