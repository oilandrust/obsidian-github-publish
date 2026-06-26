import { RepoFile } from '../settings';

const QUARTZ_INDEX_PATH = 'content/index.md';

export function ensureQuartzHomePage(contentFiles: RepoFile[], siteName: string): RepoFile[] {
  if (contentFiles.some((file) => file.path === QUARTZ_INDEX_PATH)) {
    return contentFiles;
  }

  const markdown = `---
title: ${escapeYamlString(siteName)}
---

Welcome to **${siteName}**.
`;

  return [
    ...contentFiles,
    {
      path: QUARTZ_INDEX_PATH,
      content: new TextEncoder().encode(markdown),
      encoding: 'utf-8',
    },
  ];
}

function escapeYamlString(value: string): string {
  if (/[:#{}[\],&*?|>!'"%@`]|^\s|\s$/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}
