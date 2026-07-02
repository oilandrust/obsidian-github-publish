import { EMBEDDED_ASSETS_BUNDLE } from './embeddedAssets';
import { decodeBase64, gunzipToUtf8 } from '../utils/binary';
import { parseJson } from '../utils/json';

const TOOLCHAIN_PREFIX = 'toolchain-quartz/';

interface EmbeddedFile {
  path: string;
  encoding: 'utf8' | 'base64';
  data: string;
}

interface EmbeddedBundle {
  files: EmbeddedFile[];
}

interface ToolchainManifest {
  files?: string[];
}

let cachedBundle: Map<string, EmbeddedFile> | null = null;

function loadEmbeddedBundle(): Map<string, EmbeddedFile> | null {
  if (!EMBEDDED_ASSETS_BUNDLE) {
    return null;
  }
  if (cachedBundle) {
    return cachedBundle;
  }

  const compressed = decodeBase64(EMBEDDED_ASSETS_BUNDLE);
  const json = gunzipToUtf8(compressed);
  const bundle = parseJson<EmbeddedBundle>(json);
  cachedBundle = new Map(bundle.files.map((file) => [file.path, file]));
  return cachedBundle;
}

function requireEmbeddedBundle(): Map<string, EmbeddedFile> {
  const bundle = loadEmbeddedBundle();
  if (!bundle) {
    throw new Error(quartzToolchainMissingMessage());
  }
  return bundle;
}

export function quartzToolchainMissingMessage(): string {
  return (
    'Publish toolchain is missing.\n\n' +
    'The Quartz toolchain should be embedded in main.js. ' +
    'Try reloading Obsidian or reinstalling the plugin from the community store.\n\n' +
    'Developers: run npm run build:plugin (or npm run sync:toolchain && npm run build).'
  );
}

function loadManifestFromEmbedded(bundle: Map<string, EmbeddedFile>): string[] {
  const manifestFile = bundle.get(`${TOOLCHAIN_PREFIX}files.json`);
  if (!manifestFile || manifestFile.encoding !== 'utf8') {
    throw new Error('Embedded Quartz toolchain is missing files.json');
  }
  const manifest = parseJson<ToolchainManifest | string[]>(manifestFile.data);
  return Array.isArray(manifest) ? manifest : manifest.files ?? [];
}

export function loadToolchainManifest(): string[] {
  return loadManifestFromEmbedded(requireEmbeddedBundle());
}

export function readToolchainText(relativePath: string): string {
  const bundle = requireEmbeddedBundle();
  const embeddedPath = `${TOOLCHAIN_PREFIX}${relativePath}`;
  const file = bundle.get(embeddedPath);
  if (!file || file.encoding !== 'utf8') {
    throw new Error(`Embedded toolchain file missing: ${relativePath}`);
  }
  return file.data;
}

export function readToolchainBytes(relativePath: string): Uint8Array {
  const bundle = requireEmbeddedBundle();
  const embeddedPath = `${TOOLCHAIN_PREFIX}${relativePath}`;
  const file = bundle.get(embeddedPath);
  if (!file) {
    throw new Error(`Embedded toolchain file missing: ${relativePath}`);
  }
  if (file.encoding === 'utf8') {
    return new TextEncoder().encode(file.data);
  }
  return decodeBase64(file.data);
}

export function assertQuartzToolchainAvailable(): void {
  loadToolchainManifest();
}
