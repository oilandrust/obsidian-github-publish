import { App, Modal } from 'obsidian';
import { PublishedSite } from '../settings';
import { getSiteRepoUrl, siteId } from '../sites';
import { childDiv, childEl } from './dom';

export class UntrackSiteModal extends Modal {
  constructor(
    app: App,
    private readonly site: PublishedSite,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('github-publish-modal');

    const repoUrl = getSiteRepoUrl(this.site);

    childEl(contentEl, 'h2', { text: 'Stop tracking this site?' });

    childEl(contentEl, 'p', {
      text: `GitHub Publish will stop tracking "${this.site.siteName}". Your vault notes are not changed.`,
    });

    childEl(contentEl, 'p', {
      text: 'The GitHub repository will still exist. Delete it on GitHub if you no longer need the published site.',
    });

    const linkRow = childDiv(contentEl, { cls: 'github-publish-untrack-repo-link' });
    childEl(linkRow, 'span', { text: 'Repository: ' });
    const link = childEl(linkRow, 'a', {
      href: repoUrl,
      text: siteId(this.site.owner, this.site.repo),
    });
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const nav = childDiv(contentEl, { cls: 'github-publish-buttons' });
    const cancelBtn = childEl(nav, 'button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const confirmBtn = childEl(nav, 'button', {
      text: 'Stop tracking',
      cls: 'mod-warning',
    });
    confirmBtn.addEventListener('click', () => {
      this.onConfirm();
      this.close();
    });
  }
}
