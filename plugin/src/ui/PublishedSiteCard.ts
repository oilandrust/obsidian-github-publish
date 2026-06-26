import { App, Notice } from 'obsidian';
import { checkPublishStatus, StatusCheck } from '../github/publishStatus';
import { detectUnpublishedChanges } from '../publish/publishChanges';
import { countDiffChanges } from '../publish/diffVault';
import { PublishedSite } from '../settings';
import { getSiteLiveUrl, getSiteRepoUrl } from '../sites';
import {
  getQuartzVersionLabel,
  resolveQuartzCommitSha,
} from '../quartz/versions';
import { showAdvancedSettings } from '../buildFlags';
import GitHubPublishPlugin from '../../main';

export class PublishedSiteCard {
  constructor(
    private readonly app: App,
    private readonly plugin: GitHubPublishPlugin,
    private readonly site: PublishedSite,
    private readonly isStale: () => boolean,
    private readonly onPublishChanges: (site: PublishedSite) => void,
  ) {}

  render(container: HTMLElement): void {
    const liveUrl = getSiteLiveUrl(this.site);
    const repoUrl = getSiteRepoUrl(this.site);
    const token = this.plugin.settings.accessToken;

    const card = container.createDiv({ cls: 'github-publish-site-card' });
    card.createEl('h4', { text: this.site.siteName });

    const summary = card.createEl('dl', { cls: 'github-publish-summary' });
    this.addSummaryRow(summary, 'Vault folder', this.site.contentFolder);

    if (showAdvancedSettings) {
      this.addSummaryRow(
        summary,
        'Template',
        this.site.templateEngine === 'inhouse' ? 'Built-in' : 'Quartz',
      );
      if (this.site.templateEngine === 'quartz') {
        const sha = resolveQuartzCommitSha(this.site.quartzCommitSha);
        this.addSummaryRow(summary, 'Quartz version', getQuartzVersionLabel(sha));
      }
    }

    summary.createEl('dt', { text: 'Repository' });
    const repoValue = summary.createEl('dd');
    const repoStatus = repoValue.createSpan({
      cls: 'github-publish-status github-publish-status-checking',
    });
    repoStatus.setText('Checking…');
    repoValue.createEl('br');
    const repoLink = repoValue.createEl('a', {
      cls: 'github-publish-live-link',
      href: repoUrl,
      text: repoUrl,
    });
    repoLink.target = '_blank';
    repoLink.rel = 'noopener noreferrer';

    summary.createEl('dt', { text: 'Live site' });
    const liveValue = summary.createEl('dd');
    const liveStatus = liveValue.createSpan({
      cls: 'github-publish-status github-publish-status-checking',
    });
    liveStatus.setText('Checking…');
    liveValue.createEl('br');
    const liveLink = liveValue.createEl('a', {
      cls: 'github-publish-live-link',
      href: liveUrl,
      text: liveUrl,
    });
    liveLink.target = '_blank';
    liveLink.rel = 'noopener noreferrer';

    summary.createEl('dt', { text: 'Changes' });
    const changesValue = summary.createEl('dd', { cls: 'github-publish-changes-row' });
    const changesStatus = changesValue.createSpan({
      cls: 'github-publish-status github-publish-status-checking',
    });
    changesStatus.setText('Checking for changes…');

    const publishBtn = changesValue.createEl('button', {
      cls: 'mod-cta github-publish-changes-button',
      text: 'Publish changes',
    });
    publishBtn.disabled = true;
    publishBtn.addEventListener('click', () => {
      if (!token) {
        new Notice('Connect to GitHub in settings first.');
        return;
      }
      this.onPublishChanges(this.site);
    });

    if (token) {
      void checkPublishStatus(token, this.site.owner, this.site.repo, liveUrl).then((result) => {
        if (this.isStale()) return;
        this.applyStatusCheck(repoStatus, result.repository);
        this.applyStatusCheck(liveStatus, result.liveSite);
      });
    } else {
      repoStatus.setText('Connect GitHub to check status');
      liveStatus.setText('Connect GitHub to check status');
    }

    void detectUnpublishedChanges(this.app, this.site).then((result) => {
      if (this.isStale()) return;
      if (!result) {
        changesStatus.removeClass('github-publish-status-checking');
        changesStatus.addClass('github-publish-status-error');
        changesStatus.setText('Unable to check for changes');
        return;
      }

      const hasChanges = countDiffChanges(result.diff) > 0;
      changesStatus.removeClass(
        'github-publish-status-checking',
        'github-publish-status-live',
        'github-publish-status-unreachable',
      );
      changesStatus.addClass(
        hasChanges ? 'github-publish-changes-pending' : 'github-publish-status-live',
      );
      changesStatus.setText(result.summary);
      publishBtn.disabled = !hasChanges;
    });
  }

  private applyStatusCheck(element: HTMLElement, check: StatusCheck): void {
    element.removeClass(
      'github-publish-status-checking',
      'github-publish-status-live',
      'github-publish-status-unreachable',
      'github-publish-status-error',
    );
    element.addClass(`github-publish-status-${check.status}`);
    const statusLabel =
      check.status === 'live'
        ? 'Live'
        : check.status === 'unreachable'
          ? 'Unreachable'
          : check.status === 'error'
            ? 'Error'
            : 'Checking…';
    element.setText(`${statusLabel} — ${check.detail}`);
  }

  private addSummaryRow(dl: HTMLElement, label: string, value: string): void {
    dl.createEl('dt', { text: label });
    dl.createEl('dd', { text: value || '—' });
  }
}
