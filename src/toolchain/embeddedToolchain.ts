import { EMBEDDED_ASSETS_BUNDLE } from './embeddedAssets';
import { decodeBase64, fileExists, gunzipToUtf8, readBytesFile, readTextFile } from '../utils/fs';
import { joinPath } from '../utils/path';
import { parseJson } from '../utils/json';

const TOOLCHAIN_DIR_NAME = 'toolchain-quartz';
const TOOLCHAIN_PREFIX = `${TOOLCHAIN_DIR_NAME}/`;

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

function toolchainDir(pluginDir: string): string {
  return joinPath(pluginDir, 'assets', TOOLCHAIN_DIR_NAME);
}

export function quartzToolchainMissingMessage(pluginDir: string): string {
  const dir = toolchainDir(pluginDir);
  return (
    `Publish toolchain is missing.\n\n` +
    `Expected embedded assets in main.js or assets/${TOOLCHAIN_DIR_NAME}/ on disk. ` +
    'Try reloading Obsidian or reinstalling the plugin from the community store.\n\n' +
    `Developers: run npm run build:plugin (or npm run sync:toolchain && npm run build). Missing path: ${dir}`
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

function loadManifestFromDisk(pluginDir: string): string[] {
  const manifestPath = joinPath(toolchainDir(pluginDir), 'files.json');
  if (!fileExists(manifestPath)) {
    throw new Error(quartzToolchainMissingMessage(pluginDir));
  }
  const manifest = parseJson<ToolchainManifest | string[]>(readTextFile(manifestPath));
  return Array.isArray(manifest) ? manifest : manifest.files ?? [];
}

export function loadToolchainManifest(pluginDir: string): string[] {
  const bundle = loadEmbeddedBundle();
  if (bundle) {
    return loadManifestFromEmbedded(bundle);
  }
  return loadManifestFromDisk(pluginDir);
}

export function readToolchainText(pluginDir: string, relativePath: string): string {
  const bundle = loadEmbeddedBundle();
  const embeddedPath = `${TOOLCHAIN_PREFIX}${relativePath}`;
  if (bundle) {
    const file = bundle.get(embeddedPath);
    if (!file || file.encoding !== 'utf8') {
      throw new Error(`Embedded toolchain file missing: ${relativePath}`);
    }
    return file.data;
  }
  return readTextFile(joinPath(toolchainDir(pluginDir), relativePath));
}

export function readToolchainBytes(pluginDir: string, relativePath: string): Uint8Array {
  const bundle = loadEmbeddedBundle();
  const embeddedPath = `${TOOLCHAIN_PREFIX}${relativePath}`;
  if (bundle) {
    const file = bundle.get(embeddedPath);
    if (!file) {
      throw new Error(`Embedded toolchain file missing: ${relativePath}`);
    }
    if (file.encoding === 'utf8') {
      return new TextEncoder().encode(file.data);
    }
    return decodeBase64(file.data);
  }
  return readBytesFile(joinPath(toolchainDir(pluginDir), relativePath));
}

export function assertQuartzToolchainAvailable(pluginDir: string): void {
  loadToolchainManifest(pluginDir);
}
