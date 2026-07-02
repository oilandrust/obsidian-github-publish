import { EMBEDDED_ASSETS_BUNDLE } from './embeddedAssets';
import {
  decodeBase64,
  ensureDirSync,
  fileExists,
  gunzipToUtf8,
  readTextFile,
  writeBytesFileSync,
  writeTextFileSync,
} from '../utils/fs';
import { dirname, joinPath } from '../utils/path';
import { parseJson } from '../utils/json';

interface EmbeddedFile {
  path: string;
  encoding: 'utf8' | 'base64';
  data: string;
}

interface EmbeddedBundle {
  files: EmbeddedFile[];
}

const VERSION_MARKER = 'assets/.bundle-version';
const QUARTZ_MANIFEST = 'assets/toolchain-quartz/manifest.json';

function needsExtract(pluginDir: string, pluginVersion: string): boolean {
  if (!EMBEDDED_ASSETS_BUNDLE) {
    return false;
  }

  const quartzManifest = joinPath(pluginDir, QUARTZ_MANIFEST);
  if (!fileExists(quartzManifest)) {
    return true;
  }

  const versionPath = joinPath(pluginDir, VERSION_MARKER);
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
  const compressed = decodeBase64(EMBEDDED_ASSETS_BUNDLE);
  const json = gunzipToUtf8(compressed);
  return parseJson<EmbeddedBundle>(json);
}

function writeEmbeddedFile(pluginDir: string, file: EmbeddedFile): void {
  const absolute = joinPath(pluginDir, 'assets', file.path);
  ensureDirSync(dirname(absolute));
  if (file.encoding === 'utf8') {
    writeTextFileSync(absolute, file.data);
    return;
  }
  writeBytesFileSync(absolute, decodeBase64(file.data));
}

export function ensureEmbeddedAssetsExtracted(pluginDir: string, pluginVersion: string): void {
  if (!needsExtract(pluginDir, pluginVersion)) {
    return;
  }

  const bundle = decodeBundle();
  for (const file of bundle.files) {
    writeEmbeddedFile(pluginDir, file);
  }

  const versionPath = joinPath(pluginDir, VERSION_MARKER);
  ensureDirSync(dirname(versionPath));
  writeTextFileSync(versionPath, `${pluginVersion}\n`);
}
