import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { marked } from 'marked';
import { assetPublicUrl, buildFileIndex, resolveAsset } from './resolve-asset.mjs';

const WIKILINK_EMBED_RE = /!\[\[([^\]]+)\]\]/g;

function stripFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    return { body: content, frontmatter: null };
  }

  try {
    const frontmatter = yaml.load(match[1]);
    return { body: match[2], frontmatter };
  } catch {
    return { body: content, frontmatter: null };
  }
}

function transformWikilinks(body, noteRelativePath, contentDir, fileIndex, warnings) {
  return body.replace(WIKILINK_EMBED_RE, (fullMatch, rawTarget) => {
    const [target, alias] = rawTarget.split('|').map((part) => part.trim());
    const resolved = resolveAsset(target, noteRelativePath, contentDir, fileIndex);

    if (!resolved) {
      warnings.push(`Unresolved wikilink in ${noteRelativePath}: ![[${rawTarget}]]`);
      return `<span class="broken-link">Missing: ${target}</span>`;
    }

    const url = assetPublicUrl(resolved);
    const ext = path.extname(resolved).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      const width = alias && /^\d+$/.test(alias) ? ` width="${alias}"` : '';
      return `\n<img src="${url}" alt="${path.basename(resolved)}"${width} />\n`;
    }

    if (ext === '.mp3') {
      return `\n<audio controls src="${url}"></audio>\n`;
    }

    if (ext === '.pdf') {
      return `\n<iframe src="${url}" title="${path.basename(resolved)}" class="asset-pdf"></iframe>\n`;
    }

    return `\n<a href="${url}">${path.basename(resolved)}</a>\n`;
  });
}

export function parseMarkdownFile(
  noteRelativePath,
  contentDir,
  fileIndex,
  warnings,
) {
  const absolutePath = path.join(contentDir, noteRelativePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const { body } = stripFrontmatter(raw);
  const withResolvedLinks = transformWikilinks(
    body,
    noteRelativePath,
    contentDir,
    fileIndex,
    warnings,
  );

  return marked.parse(withResolvedLinks, { async: false });
}

export function parseAllNotes(notePaths, contentDir, allFiles, warnings) {
  const fileIndex = buildFileIndex(allFiles);
  const noteHtmlByPath = new Map();

  for (const notePath of notePaths) {
    const html = parseMarkdownFile(notePath, contentDir, fileIndex, warnings);
    noteHtmlByPath.set(notePath, html);
  }

  return noteHtmlByPath;
}

export function copyAssets(assetPaths, contentDir, outputAssetsDir) {
  fs.mkdirSync(outputAssetsDir, { recursive: true });

  for (const assetPath of assetPaths) {
    const source = path.join(contentDir, assetPath);
    const destination = path.join(outputAssetsDir, assetPath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}
