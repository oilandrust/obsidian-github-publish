import fs from 'fs';
import path from 'path';

const EXCLUDED_DIRS = new Set(['.git', '.obsidian', 'node_modules']);
const EXCLUDED_FILES = new Set(['.DS_Store']);
const SKIPPED_EXTENSIONS = new Set(['.canvas']);

const NOTE_EXT = '.md';
const ASSET_EXTENSIONS = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.pdf', 'application/pdf'],
  ['.mp3', 'audio/mpeg'],
]);

export function pathToId(relativePath) {
  return relativePath
    .replace(/\.[^.]+$/, '')
    .split(/[/\\]/)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getTitleFromPath(relativePath) {
  const basename = path.basename(relativePath);
  const ext = path.extname(basename);
  return basename.slice(0, basename.length - ext.length);
}

function shouldSkipFile(relativePath) {
  const basename = path.basename(relativePath);
  if (EXCLUDED_FILES.has(basename)) return true;

  const ext = path.extname(relativePath).toLowerCase();
  if (SKIPPED_EXTENSIONS.has(ext)) return true;

  if (relativePath.toLowerCase().endsWith('.excalidraw.md')) {
    return 'excalidraw';
  }

  return false;
}

function classifyFile(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();

  if (ext === NOTE_EXT) {
    return { kind: 'note', relativePath };
  }

  const mime = ASSET_EXTENSIONS.get(ext);
  if (mime) {
    return { kind: 'asset', relativePath, mime };
  }

  return null;
}

function walkDirectory(contentDir, currentDir = contentDir, relativeDir = '') {
  const entries = [];
  const warnings = [];

  let dirents;
  try {
    dirents = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return { entries, warnings };
  }

  const sorted = dirents.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  for (const dirent of sorted) {
    const name = dirent.name;
    const relativePath = relativeDir ? `${relativeDir}/${name}` : name;

    if (dirent.isDirectory()) {
      if (EXCLUDED_DIRS.has(name)) continue;

      const child = walkDirectory(contentDir, path.join(currentDir, name), relativePath);
      warnings.push(...child.warnings);

      if (child.entries.length > 0) {
        entries.push({
          type: 'folder',
          name,
          children: child.entries,
        });
      }
      continue;
    }

    const skip = shouldSkipFile(relativePath);
    if (skip === true) continue;
    if (skip === 'excalidraw') {
      warnings.push(`Skipping Excalidraw note: ${relativePath}`);
      continue;
    }

    const classified = classifyFile(relativePath);
    if (!classified) continue;

    entries.push(classified);
  }

  return { entries, warnings };
}

function entriesToTreeNodes(entries, noteHtmlByPath) {
  const nodes = [];

  for (const entry of entries) {
    if (entry.type === 'folder') {
      nodes.push({
        type: 'folder',
        name: entry.name,
        children: entriesToTreeNodes(entry.children, noteHtmlByPath),
      });
      continue;
    }

    const title = getTitleFromPath(entry.relativePath);
    const id = pathToId(entry.relativePath);

    if (entry.kind === 'note') {
      nodes.push({
        type: 'note',
        id,
        path: entry.relativePath,
        title,
        html: noteHtmlByPath.get(entry.relativePath) ?? '',
      });
      continue;
    }

    nodes.push({
      type: 'asset',
      id,
      path: entry.relativePath,
      title,
      mime: entry.mime,
    });
  }

  return nodes;
}

export function scanContent(contentDir) {
  const absoluteContentDir = path.resolve(contentDir);
  const { entries, warnings } = walkDirectory(absoluteContentDir);

  const allFiles = [];
  collectFiles(entries, allFiles);

  return {
    entries,
    allFiles,
    warnings,
    contentDir: absoluteContentDir,
  };
}

function collectFiles(entries, allFiles) {
  for (const entry of entries) {
    if (entry.type === 'folder') {
      collectFiles(entry.children, allFiles);
      continue;
    }
    allFiles.push(entry.relativePath);
  }
}

export function buildSiteTree(entries, noteHtmlByPath) {
  return entriesToTreeNodes(entries, noteHtmlByPath);
}

export function listNotes(entries) {
  const notes = [];
  collectNotes(entries, notes);
  return notes;
}

function collectNotes(entries, notes) {
  for (const entry of entries) {
    if (entry.type === 'folder') {
      collectNotes(entry.children, notes);
      continue;
    }
    if (entry.kind === 'note') {
      notes.push(entry.relativePath);
    }
  }
}

export function listAssets(entries) {
  const assets = [];
  collectAssets(entries, assets);
  return assets;
}

function collectAssets(entries, assets) {
  for (const entry of entries) {
    if (entry.type === 'folder') {
      collectAssets(entry.children, assets);
      continue;
    }
    if (entry.kind === 'asset') {
      assets.push({ path: entry.relativePath, mime: entry.mime });
    }
  }
}
