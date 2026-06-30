import * as fs from 'fs';
import { callBound, callFn } from './call';

function asString(value: unknown): string {
  return value as string;
}

function asBoolean(value: unknown): boolean {
  return value as boolean;
}

export function readTextFile(path: string): string {
  const data: unknown = callFn(callBound(fs, 'readFileSync'), path, 'utf8');
  return asString(data);
}

export function readBytesFile(path: string): Uint8Array {
  const data: unknown = callFn(callBound(fs, 'readFileSync'), path);
  return data as Uint8Array;
}

export function fileExists(path: string): boolean {
  const exists: unknown = callFn(callBound(fs, 'existsSync'), path);
  return asBoolean(exists);
}
