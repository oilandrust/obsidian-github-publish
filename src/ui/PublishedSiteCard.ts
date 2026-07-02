import { App, Notice } from 'obsidian';
import { checkPublishStatus, StatusCheck } from '../github/publishStatus';
import { detectUnpublishedChanges } from '../publish/publishChanges';
import { countDiffChanges } from '../publish/diffVault';
import { PublishedSite } from '../settings';
import { getSiteLiveUrl, getSiteRepoUrl, siteId } from '../sites';
import {
  getQuartzVersionLabel,
  resolveQuartzCommitSha,
} from '../quartz/versions';
import { showAdvancedSettings } from '../buildFlags';
import { GitHubPublishHost } from '../pluginHost';
import { childDiv, childEl, childSpan, addTrashButton } from './dom';
import { UntrackSiteModal } from './UntrackSiteModal';

export class PublishedSiteCard {
  constructor(
    private readonly app: App,
    private readonly plugin: GitHubPublishHost,
    private readonly site: PublishedSite,
    private readonly isStale: () => boolean,
    private readonly onPublishChanges: (site: PublishedSite) => void,
    private readonly onUntrack: (site: PublishedSite) => void,
  ) {}

  render(container: HTMLElement): void {
    const liveUrl = getSiteLiveUrl(this.site);
    const repoUrl = getSiteRepoUrl(this.site);
    const token = this.plugin.settings.accessToken;

    const card = childDiv(container, { cls: 'github-publish-site-card' });
    const header = childDiv(card, { cls: 'github-publish-site-card-header' });
    childEl(header, 'h4', { text: this.site.siteName });
    addTrashButton(header, {
      ariaLabel: `Stop tracking ${this.site.siteName}`,
      onClick: () => {
        new UntrackSiteModal(this.app, this.site, () => {
          this.onUntrack(this.site);
        }).open();
      },
    });

    const summary = childEl(card, 'dl', { cls: 'github-publish-summary' });
    this.addSummaryRow(summary, 'Vault folder', this.site.contentFolder);

    if (showAdvancedSettings) {
      const sha = resolveQuartzCommitSha(this.site.quartzCommitSha);
      this.addSummaryRow(summary, 'Quartz version', getQuartzVersionLabel(sha));
    }

    childEl(summary, 'dt', { text: 'Repository' });
    const repoValue = childEl(summary, 'dd', { cls: 'github-publish-summary-inline' });
    const repoStatus = childSpan(repoValue, {
      cls: 'github-publish-status github-publish-status-checking',
    });
    repoStatus.setText('Checking…');
    const repoLink = childEl(repoValue, 'a', {
      cls: 'github-publish-summary-link',
      href: repoUrl,
      text: siteId(this.site.owner, this.site.repo),
    });
    repoLink.target = '_blank';
    repoLink.rel = 'noopener noreferrer';

    childEl(summary, 'dt', { text: 'Live site' });
    const liveValue = childEl(summary, 'dd', { cls: 'github-publish-summary-inline' });
    const liveStatus = childSpan(liveValue, {
      cls: 'github-publish-status github-publish-status-checking',
    });
    liveStatus.setText('Checking…');
    const liveLink = childEl(liveValue, 'a', {
      cls: 'github-publish-summary-link',
      href: liveUrl,
      text: liveUrl,
    });
    liveLink.target = '_blank';
    liveLink.rel = 'noopener noreferrer';

    childEl(summary, 'dt', { text: 'Changes' });
    const changesValue = childEl(summary, 'dd', { cls: 'github-publish-changes-row' });
    const changesStatus = childSpan(changesValue, {
      cls: 'github-publish-status github-publish-status-checking',
    });

    const isPublishing = this.plugin.isSitePublishing(this.site.id);
    let publishBtn: HTMLButtonElement | null = null;

    if (isPublishing) {
      changesStatus.setText('Publishing in progress');
    } else {
      changesStatus.setText('Checking for changes…');

      publishBtn = childEl(changesValue, 'button', {
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
    }

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

    if (isPublishing) {
      return;
    }

    void detectUnpublishedChanges(this.app, this.site).then((result) => {
      if (this.isStale()) return;
      if (!publishBtn) return;
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
    element.setText(statusLabel);
  }

  private addSummaryRow(dl: HTMLElement, label: string, value: string): void {
    childEl(dl, 'dt', { text: label });
    childEl(dl, 'dd', { text: value || '—' });
  }
}
