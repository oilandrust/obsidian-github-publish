import { Vault } from 'obsidian';

const INDEX_FILENAME = 'index.md';

/**
 * Ensures the published folder has a top-level index.md for Quartz's home page.
 * Creates it in the vault on first publish when missing; returns true if created.
 */
export async function ensureQuartzHomePage(
  vault: Vault,
  contentFolder: string,
  siteName: string,
): Promise<boolean> {
  const indexPath = contentFolder ? `${contentFolder}/${INDEX_FILENAME}` : INDEX_FILENAME;
  if (vault.getAbstractFileByPath(indexPath)) {
    return false;
  }

  const markdown = `---
title: ${escapeYamlString(siteName)}
---

This file has been created automatically by GitHub Publish plugin. Quartz expects a 'index.md' at the top level to render the home page of your site, feel free to edit the title and write your content!
`;

  await vault.create(indexPath, markdown);
  return true;
}

function escapeYamlString(value: string): string {
  if (/[:#{}[\],&*?|>!'"%@`]|^\s|\s$/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}
