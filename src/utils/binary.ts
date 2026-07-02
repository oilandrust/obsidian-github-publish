import * as zlibImport from 'zlib';

interface NodeZlib {
  gunzipSync(data: Uint8Array): Uint8Array;
}

const nodeZlib = zlibImport as unknown as NodeZlib;

function asUint8Array(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new Error('Expected binary file contents');
  }
  return value;
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
