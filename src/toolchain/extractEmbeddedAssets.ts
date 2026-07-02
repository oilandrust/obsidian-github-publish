import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { EMBEDDED_ASSETS_BUNDLE } from './embeddedAssets';
import { fileExists, readTextFile } from '../utils/fs';

import { parseJson } from '../utils/json';

interface EmbeddedFile {
  path: string;
  encoding: 'utf8' | 'base64';
  data: string;
}

interface EmbeddedBundle {
  files: EmbeddedFile[];
}

const VERSION_MARKER = path.join('assets', '.bundle-version');
const QUARTZ_MANIFEST = path.join('assets', 'toolchain-quartz', 'manifest.json');

function needsExtract(pluginDir: string, pluginVersion: string): boolean {
  if (!EMBEDDED_ASSETS_BUNDLE) {
    return false;
  }

  const quartzManifest = path.join(pluginDir, QUARTZ_MANIFEST);
  if (!fileExists(quartzManifest)) {
    return true;
  }

  const versionPath = path.join(pluginDir, VERSION_MARKER);
  if (!fileExists(versionPath)) {
    return true;
  }

  const installedVersion = readTextFile(versionPath).trim();
  if (installedVersion !== pluginVersion) {
    return true;
  }

  return false;
}

function decodeBundle(): EmbeddedBundle {
  const compressed = Buffer.from(EMBEDDED_ASSETS_BUNDLE, 'base64');
  const json = zlib.gunzipSync(compressed).toString('utf8');
  return parseJson<EmbeddedBundle>(json);
}

function writeEmbeddedFile(pluginDir: string, file: EmbeddedFile): void {
  const absolute = path.join(pluginDir, 'assets', file.path);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  if (file.encoding === 'utf8') {
    fs.writeFileSync(absolute, file.data, 'utf8');
    return;
  }
  fs.writeFileSync(absolute, Buffer.from(file.data, 'base64'));
}

export function ensureEmbeddedAssetsExtracted(pluginDir: string, pluginVersion: string): void {
  if (!needsExtract(pluginDir, pluginVersion)) {
    return;
  }

  const bundle = decodeBundle();
  for (const file of bundle.files) {
    writeEmbeddedFile(pluginDir, file);
  }

  const versionPath = path.join(pluginDir, VERSION_MARKER);
  fs.mkdirSync(path.dirname(versionPath), { recursive: true });
  fs.writeFileSync(versionPath, `${pluginVersion}\n`, 'utf8');
}
