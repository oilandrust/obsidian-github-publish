import { nodeFs, nodeZlib } from './nodeModules';

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
  return nodeFs.readFileSync(path, 'utf8');
}

export function readBytesFile(path: string): Uint8Array {
  return asUint8Array(nodeFs.readFileSync(path));
}

export function fileExists(path: string): boolean {
  return asBoolean(nodeFs.existsSync(path));
}

export function ensureDirSync(dirPath: string): void {
  nodeFs.mkdirSync(dirPath, { recursive: true });
}

export function writeTextFileSync(path: string, content: string): void {
  nodeFs.writeFileSync(path, content, 'utf8');
}

export function writeBytesFileSync(path: string, content: Uint8Array): void {
  nodeFs.writeFileSync(path, content);
}

export function decodeBase64(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalized = encoded.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((normalized.length * 3) / 4));
  let byteIndex = 0;
  let bits = 0;
  let bitCount = 0;

  for (const char of normalized) {
    const value = alphabet.indexOf(char);
    if (value < 0) {
      continue;
    }
    bits = (bits << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[byteIndex] = (bits >> bitCount) & 0xff;
      byteIndex++;
    }
  }

  return bytes.subarray(0, byteIndex);
}

export function gunzipToUtf8(data: Uint8Array): string {
  const decompressed = nodeZlib.gunzipSync(data);
  return new TextDecoder().decode(asUint8Array(decompressed));
}
