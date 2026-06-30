#!/usr/bin/env node
/**
 * Push updated bundled toolchain files to published Quartz sites.
 * Usage: node scripts/upgrade-site-toolchain.mjs <owner/repo> [...]
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PLUGIN_DIR = path.join(ROOT, 'plugin');
const TOOLCHAIN_DIR = path.join(PLUGIN_DIR, 'assets', 'toolchain-quartz');
const DEFAULT_QUARTZ_COMMIT = '9cf87ff1c248a8ca551093214b0fec3b31415009';

const SITES = {
  'oilandrust/githubpublish-wiki': {
    owner: 'oilandrust',
    repo: 'githubpublish-wiki',
    siteName: 'GitHub Publish Development Wiki',
    quartzCommitSha: DEFAULT_QUARTZ_COMMIT,
  },
  'oilandrust/catsnake-wiki': {
    owner: 'oilandrust',
    repo: 'catsnake-wiki',
    siteName: 'CatSnake Development Wiki',
    quartzCommitSha: DEFAULT_QUARTZ_COMMIT,
  },
};

function ghApi(method, endpoint, body) {
  const args = ['api', '-X', method, endpoint];
  if (body !== undefined) {
    args.push('--input', '-');
  }
  const result = execSync(`gh ${args.map((a) => JSON.stringify(a)).join(' ')}`, {
    input: body !== undefined ? JSON.stringify(body) : undefined,
    encoding: 'utf8',
  });
  return result ? JSON.parse(result) : null;
}

function applyTemplate(content, context) {
  const baseUrl = `${context.owner}.github.io/${context.repo}`;
  return content
    .replaceAll('{{siteName}}', context.siteName)
    .replaceAll('{{repo}}', context.repo)
    .replaceAll('{{owner}}', context.owner)
    .replaceAll('{{pageTitle}}', context.siteName)
    .replaceAll('{{baseUrl}}', baseUrl)
    .replaceAll('{{quartzCommitSha}}', context.quartzCommitSha);
}

function loadToolchainFiles(context) {
  const manifest = JSON.parse(fs.readFileSync(path.join(TOOLCHAIN_DIR, 'manifest.json'), 'utf8'));
  const files = [];

  for (const relativePath of manifest) {
    const absolute = path.join(TOOLCHAIN_DIR, relativePath);
    const raw = fs.readFileSync(absolute, 'utf8');
    const outputPath = relativePath.endsWith('.template')
      ? relativePath.slice(0, -'.template'.length)
      : relativePath;
    files.push({
      path: outputPath,
      content: applyTemplate(raw, context),
    });
  }

  return files;
}

function createCommit(owner, repo, files, message) {
  const repoInfo = ghApi('GET', `repos/${owner}/${repo}`);
  const branch = repoInfo.default_branch || 'main';
  const ref = ghApi('GET', `repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const parentSha = ref.object.sha;
  const parentCommit = ghApi('GET', `repos/${owner}/${repo}/git/commits/${parentSha}`);
  const baseTreeSha = parentCommit.tree.sha;

  const tree = [];
  for (const file of files) {
    const blob = ghApi('POST', `repos/${owner}/${repo}/git/blobs`, {
      content: file.content,
      encoding: 'utf-8',
    });
    tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const newTree = ghApi('POST', `repos/${owner}/${repo}/git/trees`, {
    base_tree: baseTreeSha,
    tree,
  });

  const commit = ghApi('POST', `repos/${owner}/${repo}/git/commits`, {
    message,
    tree: newTree.sha,
    parents: [parentSha],
  });

  ghApi('PATCH', `repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    sha: commit.sha,
    force: false,
  });

  return commit.sha;
}

function upgradeSite(siteKey) {
  const context = SITES[siteKey];
  if (!context) {
    throw new Error(`Unknown site: ${siteKey}`);
  }

  const files = loadToolchainFiles(context);
  console.log(`Upgrading ${siteKey} (${files.length} toolchain files)…`);
  for (const file of files) {
    console.log(`  - ${file.path}`);
  }

  const sha = createCommit(
    context.owner,
    context.repo,
    files,
    'Update Quartz toolchain (GitHub Pages actions v5, Node 24)',
  );

  console.log(`Committed ${sha.slice(0, 7)} to ${siteKey}`);
  return sha;
}

const targets = process.argv.slice(2);
const siteKeys = targets.length > 0 ? targets : Object.keys(SITES);

for (const siteKey of siteKeys) {
  upgradeSite(siteKey);
}
