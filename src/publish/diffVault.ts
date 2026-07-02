import { RepoFile } from '../settings';

export interface PublishDiff {
  adds: RepoFile[];
  updates: RepoFile[];
  deletes: string[];
  unchanged: string[];
}

export function hashFileContent(bytes: Uint8Array): string {
  let hash = 0;
  for (const byte of bytes) {
    hash = (hash * 31 + byte) >>> 0;
  }
  return `hash:${hash.toString(16)}`;
}

export function buildContentManifest(files: RepoFile[]): Record<string, string> {
  const manifest: Record<string, string> = {};
  for (const file of files) {
    if (!file.path.startsWith('content/')) continue;
    manifest[file.path] = hashFileContent(file.content);
  }
  return manifest;
}

export function diffAgainstManifest(
  manifest: Record<string, string>,
  scannedFiles: RepoFile[],
): PublishDiff {
  const adds: RepoFile[] = [];
  const updates: RepoFile[] = [];
  const unchanged: string[] = [];
  const seen = new Set<string>();

  for (const file of scannedFiles) {
    if (!file.path.startsWith('content/')) continue;
    seen.add(file.path);
    const hash = hashFileContent(file.content);
    const previous = manifest[file.path];
    if (previous === undefined) {
      adds.push(file);
    } else if (previous !== hash) {
      updates.push(file);
    } else {
      unchanged.push(file.path);
    }
  }

  const deletes: string[] = [];
  for (const path of Object.keys(manifest)) {
    if (!seen.has(path)) {
      deletes.push(path);
    }
  }

  return { adds, updates, deletes, unchanged };
}

export function countDiffChanges(diff: PublishDiff): number {
  return diff.adds.length + diff.updates.length + diff.deletes.length;
}

export function formatDiffSummary(diff: PublishDiff): string {
  const total = countDiffChanges(diff);
  if (total === 0) return 'Up to date';

  const parts: string[] = [];
  if (diff.adds.length) parts.push(`${diff.adds.length} added`);
  if (diff.updates.length) parts.push(`${diff.updates.length} updated`);
  if (diff.deletes.length) parts.push(`${diff.deletes.length} deleted`);

  return `${total} change${total === 1 ? '' : 's'} (${parts.join(', ')})`;
}

export function mergeManifestAfterPublish(
  manifest: Record<string, string>,
  diff: PublishDiff,
): Record<string, string> {
  const next = { ...manifest };
  for (const path of diff.deletes) {
    delete next[path];
  }
  for (const file of [...diff.adds, ...diff.updates]) {
    next[file.path] = hashFileContent(file.content);
  }
  return next;
}
