import { RepoFile } from '../settings';

const COMMUNITY_PLUGIN_URL = 'https://community.obsidian.md/plugins/github-publish';

export function buildPublishedSiteReadme(): RepoFile {
  const markdown = `Site published with Quartz with the help of the [GitHub Publish](${COMMUNITY_PLUGIN_URL}) Obsidian plugin.
`;

  return {
    path: 'README.md',
    content: new TextEncoder().encode(markdown),
    encoding: 'utf-8',
  };
}
