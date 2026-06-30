import * as nodePath from 'path';
import { callBound, callFn } from './call';

export function pathExtname(filePath: string): string {
  const ext: unknown = callFn(callBound(nodePath, 'extname'), filePath);
  return ext as string;
}

export function pathJoin(...parts: string[]): string {
  const joined: unknown = callFn(callBound(nodePath, 'join'), ...parts);
  return joined as string;
}
