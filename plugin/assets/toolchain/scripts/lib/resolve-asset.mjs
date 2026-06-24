import fs from 'fs';
import path from 'path';

function normalizeTarget(target) {
  return target.replace(/\\/g, '/').trim();
}

function basenameOf(target) {
  return path.posix.basename(normalizeTarget(target));
}

function tryPath(contentDir, candidate) {
  const absolute = path.join(contentDir, candidate);
  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
    return candidate.replace(/\\/g, '/');
  }
  return null;
}

export function buildFileIndex(allFiles) {
  const byBasename = new Map();

  for (const relativePath of allFiles) {
    const base = basenameOf(relativePath);
    if (!byBasename.has(base)) {
      byBasename.set(base, []);
    }
    byBasename.get(base).push(relativePath);
  }

  return byBasename;
}

export function resolveAsset(target, noteRelativePath, contentDir, fileIndex) {
  const normalized = normalizeTarget(target);
  const noteDir = path.posix.dirname(noteRelativePath.replace(/\\/g, '/'));
  const base = basenameOf(normalized);

  const candidates = [];

  if (normalized.includes('/')) {
    candidates.push(normalized);
  }

  if (noteDir && noteDir !== '.') {
    candidates.push(`${noteDir}/${base}`);
    candidates.push(`${noteDir}/${normalized}`);
  }

  candidates.push(base);

  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    const resolved = tryPath(contentDir, candidate);
    if (resolved) return resolved;
  }

  const basenameMatches = fileIndex.get(base) ?? [];
  if (basenameMatches.length === 1) {
    return basenameMatches[0];
  }

  if (basenameMatches.length > 1) {
    const inNoteDir = basenameMatches.find((match) =>
      match.startsWith(`${noteDir}/`),
    );
    if (inNoteDir) return inNoteDir;
    return basenameMatches[0];
  }

  return null;
}

export function assetPublicUrl(relativePath) {
  const encoded = relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `assets/${encoded}`;
}
