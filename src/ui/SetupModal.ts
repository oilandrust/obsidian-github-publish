import { App, Modal, Notice, Setting, TFolder } from 'obsidian';
import { listUserRepos, userRepoExists } from '../github/repos';
import { GitHubPublishHost } from '../pluginHost';
import { SetupConfig } from '../settings';
import { countFilesInFolder } from '../publish/scanVault';
import { saveSetupConfig, startPublish } from '../publish/startPublish';
import { FolderTree } from './FolderTree';
import { childDiv, childEl, addCopyButton } from './dom';

type WizardStep = 1 | 2 | 3 | 4;
type RepoNameAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'error';

const CREATE_REPO_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function humanizeFolderSegment(segment: string): string {
  const spaced = segment.replace(/[-_]+/g, ' ').trim();
  if (!spaced) return '';
  if (/[A-Z]/.test(spaced.slice(1))) {
    return spaced;
  }
  return spaced.replace(/\b\w/g, (char) => char.toUpperCase());
}

function suggestSiteNameFromFolder(folderPath: string, vaultName?: string | null): string {
  if (!folderPath) {
    const name = vaultName?.trim();
    return name ? humanizeFolderSegment(name) || name : 'My Notes';
  }
  const segment = folderPath.split('/').filter(Boolean).pop() ?? folderPath;
  return humanizeFolderSegment(segment) || segment;
}

function suggestRepoNameFromSiteName(siteName: string): string {
  let name = siteName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!name) {
    name = 'my-notes-site';
  }
  if (!/^[a-z0-9]/.test(name)) {
    name = `notes-${name}`.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  }

  return name.slice(0, 100);
}

export class SetupModal extends Modal {
  private step: WizardStep = 1;
  private siteName = '';
  private contentFolder = '';
  private repoMode: 'create' | 'existing' = 'create';
  private repoName = '';
  private siteNameEdited = false;
  private repoNameEdited = false;
  private isPublishing = false;
  private expandedFolders = new Set<string>();
  private repoNameAvailability: RepoNameAvailability = 'idle';
  private repoNameAvailabilityMessage = '';
  private repoNameCheckId = 0;
  private repoNameCheckTimer: number | null = null;
  private repoAvailabilityEl: HTMLElement | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    app: App,
    private readonly plugin: GitHubPublishHost,
  ) {
    super(app);
  }

  onOpen(): void {
    if (!this.plugin.settings.accessToken) {
      new Notice('Connect to GitHub in plugin settings first.');
      this.close();
      return;
    }

    this.siteName = '';
    this.contentFolder = '';
    this.repoMode = 'create';
    this.repoName = '';
    this.siteNameEdited = false;
    this.repoNameEdited = false;
    this.resetRepoNameAvailability();
    this.keydownHandler = (event: KeyboardEvent) => {
      this.handleWizardKeydown(event);
    };
    activeDocument.addEventListener('keydown', this.keydownHandler, true);
    this.render();
  }

  private handleWizardKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
      return;
    }
    if (this.isPublishing) {
      return;
    }
    if (!this.modalEl.contains(event.target as Node)) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      return;
    }
    if (target instanceof HTMLButtonElement && !target.classList.contains('mod-cta')) {
      return;
    }

    event.preventDefault();
    this.submitWizard();
  }

  private submitWizard(): void {
    if (this.isPublishing) {
      return;
    }
    if (this.step === 3 && this.repoMode === 'create') {
      void this.advanceFromRepoStep();
      return;
    }
    this.advanceStep();
  }

  onClose(): void {
    this.clearRepoNameCheckTimer();
    if (this.keydownHandler) {
      activeDocument.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    this.contentEl.empty();
  }

  private resetRepoNameAvailability(): void {
    this.repoNameAvailability = 'idle';
    this.repoNameAvailabilityMessage = '';
    this.repoNameCheckId++;
  }

  private clearRepoNameCheckTimer(): void {
    if (this.repoNameCheckTimer !== null) {
      window.clearTimeout(this.repoNameCheckTimer);
      this.repoNameCheckTimer = null;
    }
  }

  private scheduleRepoNameCheck(immediate = false): void {
    this.clearRepoNameCheckTimer();
    if (this.repoMode !== 'create' || this.step !== 3) {
      return;
    }

    if (immediate) {
      void this.checkRepoNameAvailability();
      return;
    }

    this.repoNameCheckTimer = window.setTimeout(() => {
      this.repoNameCheckTimer = null;
      void this.checkRepoNameAvailability();
    }, 400);
  }

  private async checkRepoNameAvailability(): Promise<boolean> {
    if (this.repoMode !== 'create') {
      this.resetRepoNameAvailability();
      this.updateRepoAvailabilityElement();
      return true;
    }

    const repoName = this.repoName.trim();
    if (!repoName || !CREATE_REPO_NAME_PATTERN.test(repoName)) {
      this.repoNameAvailability = 'idle';
      this.repoNameAvailabilityMessage = '';
      this.updateRepoAvailabilityElement();
      return false;
    }

    const token = this.plugin.settings.accessToken;
    const username = this.plugin.settings.githubUsername;
    if (!token || !username) {
      return false;
    }

    const checkId = ++this.repoNameCheckId;
    this.repoNameAvailability = 'checking';
    this.repoNameAvailabilityMessage = 'Checking repository name…';
    this.updateRepoAvailabilityElement();

    try {
      const exists = await userRepoExists(token, username, repoName);
      if (checkId !== this.repoNameCheckId) {
        return false;
      }

      if (exists) {
        this.repoNameAvailability = 'taken';
        this.repoNameAvailabilityMessage =
          `Repository ${username}/${repoName} already exists. Choose another name or switch to "Use existing repository".`;
      } else {
        this.repoNameAvailability = 'available';
        this.repoNameAvailabilityMessage = `Repository name ${username}/${repoName} is available.`;
      }
      this.updateRepoAvailabilityElement();
      return !exists;
    } catch (error: unknown) {
      if (checkId !== this.repoNameCheckId) {
        return false;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.repoNameAvailability = 'error';
      this.repoNameAvailabilityMessage = message;
      this.updateRepoAvailabilityElement();
      return false;
    }
  }

  private async ensureRepoNameAvailable(): Promise<boolean> {
    if (this.repoMode !== 'create') {
      return true;
    }
    if (this.repoNameAvailability === 'available') {
      return true;
    }
    const available = await this.checkRepoNameAvailability();
    if (
      !available &&
      (this.repoNameAvailability === 'taken' || this.repoNameAvailability === 'error')
    ) {
      new Notice(this.repoNameAvailabilityMessage || 'Repository name already exists.');
    }
    return available;
  }

  private renderRepoAvailability(container: HTMLElement): void {
    this.repoAvailabilityEl?.remove();
    this.repoAvailabilityEl = childDiv(container, { cls: 'github-publish-repo-availability' });
    this.updateRepoAvailabilityElement();
  }

  private updateRepoAvailabilityElement(): void {
    if (!this.repoAvailabilityEl) {
      return;
    }
    this.repoAvailabilityEl.empty();
    if (!this.repoNameAvailabilityMessage) {
      return;
    }

    const isError =
      this.repoNameAvailability === 'taken' || this.repoNameAvailability === 'error';
    childEl(this.repoAvailabilityEl, 'p', {
      cls: isError ? 'github-publish-step-error' : 'github-publish-repo-availability-message',
      text: this.repoNameAvailabilityMessage,
    });
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('github-publish-modal');

    childEl(contentEl, 'h2', { text: `GitHub Publish — Setup (step ${String(this.step)}/4)` });

    switch (this.step) {
      case 1:
        this.renderFolderStep(contentEl);
        break;
      case 2:
        this.renderSiteNameStep(contentEl);
        break;
      case 3:
        this.renderRepoStep(contentEl);
        break;
      case 4:
        this.renderConfirmStep(contentEl);
        break;
    }

    this.renderNav(contentEl);

    if (this.step === 4) {
      const publishBtn = contentEl.querySelector('.github-publish-buttons .mod-cta');
      if (publishBtn instanceof HTMLButtonElement && !publishBtn.disabled) {
        publishBtn.focus();
      }
    }
  }

  private applyFolderSuggestions(): void {
    if (!this.siteNameEdited) {
      this.siteName = suggestSiteNameFromFolder(this.contentFolder, this.app.vault.getName());
    }
    if (!this.repoNameEdited && this.siteName.trim()) {
      this.repoName = suggestRepoNameFromSiteName(this.siteName);
    }
  }

  private renderSiteNameStep(container: HTMLElement): void {
    childEl(container, 'p', {
      text: 'Choose a name for your published site. This appears in the browser tab and site header.',
    });

    const suggested = suggestSiteNameFromFolder(this.contentFolder, this.app.vault.getName());
    const siteNameSetting = new Setting(container).setName('Site name');
    if (!this.siteNameEdited && this.siteName === suggested) {
      siteNameSetting.setDesc(`Suggested from folder: ${this.contentFolder || '(vault root)'}`);
    }
    siteNameSetting.addText((text) => {
        text.setValue(this.siteName).onChange((value: string) => {
          this.siteName = value;
          this.siteNameEdited = true;
          if (!this.repoNameEdited) {
            this.repoName = suggestRepoNameFromSiteName(value);
          }
        });
        text.inputEl.focus();
      });
  }

  private renderFolderStep(container: HTMLElement): void {
    childEl(container, 'p', {
      text: 'Select the vault folder to publish. Its contents will be copied to content/ in your GitHub repository.',
    });

    if (this.contentFolder) {
      childEl(container, 'p', {
        cls: 'github-publish-selected-folder',
        text: `Selected: ${this.contentFolder || '(vault root)'}`,
      });
    }

    const treeHost = childDiv(container, { cls: 'github-publish-folder-tree-host' });
    new FolderTree(this.app, treeHost, {
      selectedPath: this.contentFolder,
      expandedPaths: this.expandedFolders,
      onSelect: (path) => {
        this.contentFolder = path;
        this.applyFolderSuggestions();
        this.render();
      },
      onToggleExpand: (path) => {
        if (this.expandedFolders.has(path)) {
          this.expandedFolders.delete(path);
        } else {
          this.expandedFolders.add(path);
        }
        this.render();
      },
    }).render();
  }

  private renderRepoStep(container: HTMLElement): void {
    childEl(container, 'p', { text: 'Create a new repository or use an existing empty one.' });

    new Setting(container)
      .setName('Repository')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('create', 'Create new repository')
          .addOption('existing', 'Use existing repository')
          .setValue(this.repoMode)
          .onChange((value) => {
            this.repoMode = value as 'create' | 'existing';
            this.resetRepoNameAvailability();
            this.render();
          });
      });

    if (this.repoMode === 'create') {
      const suggested = suggestRepoNameFromSiteName(this.siteName);
      new Setting(container)
        .setName('New repository name')
        .setDesc(
          this.repoNameEdited || this.repoName !== suggested
            ? 'Lowercase letters, numbers, and hyphens. Will be created as public.'
            : `Suggested from site name. Lowercase letters, numbers, and hyphens. Will be created as public.`,
        )
        .addText((text) => {
          text
            .setValue(this.repoName)
            .onChange((value: string) => {
              this.repoName = value;
              this.repoNameEdited = true;
              this.repoNameAvailability = 'idle';
              this.repoNameAvailabilityMessage = '';
              this.updateRepoAvailabilityElement();
              this.scheduleRepoNameCheck();
            })
            .setPlaceholder(suggested || 'my-notes-site');
        });
      this.renderRepoAvailability(container);
      this.scheduleRepoNameCheck(true);
    } else {
      childEl(container, 'p', { text: 'Loading repositories…' });
      void this.renderExistingRepos(container);
    }
  }

  private async renderExistingRepos(container: HTMLElement): Promise<void> {
    const token = this.plugin.settings.accessToken;
    if (!token) return;

    try {
      const repos = await listUserRepos(token);
      new Setting(container)
        .setName('Existing repository')
        .addDropdown((dropdown) => {
          dropdown.addOption('', 'Select a repository…');
          for (const repo of repos) {
            dropdown.addOption(repo.name, repo.full_name);
          }
          dropdown.setValue(this.repoName).onChange((value: string) => {
            this.repoName = value;
          });
        });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const errorRow = childDiv(container, { cls: 'github-publish-error-row' });
      childEl(errorRow, 'p', { cls: 'github-publish-step-error', text: message });
      addCopyButton(errorRow, message, {
        ariaLabel: 'Copy error message',
        successNotice: 'Error copied to clipboard',
      });
    }
  }

  private renderConfirmStep(container: HTMLElement): void {
    const fileCount = this.contentFolder
      ? countFilesInFolder(this.app.vault, this.contentFolder)
      : 0;

    childEl(container, 'p', { text: 'Review your publish settings:' });

    const summary = childEl(container, 'dl', { cls: 'github-publish-summary' });
    this.addSummaryRow(summary, 'Vault folder', this.contentFolder || '(vault root)');
    this.addSummaryRow(summary, 'Site name', this.siteName);
    this.addSummaryRow(summary, 'GitHub account', this.plugin.settings.githubUsername ?? '');
    this.addSummaryRow(
      summary,
      'Repository',
      this.repoMode === 'create'
        ? `Create: ${this.repoName}`
        : `Existing: ${this.repoName}`,
    );
    this.addSummaryRow(summary, 'Files to publish', String(fileCount));
    this.addSummaryRow(
      summary,
      'Live URL',
      `https://${this.plugin.settings.githubUsername}.github.io/${this.repoName}/`,
    );
  }

  private addSummaryRow(dl: HTMLElement, label: string, value: string): void {
    childEl(dl, 'dt', { text: label });
    childEl(dl, 'dd', { text: value || '—' });
  }

  private renderNav(container: HTMLElement): void {
    const nav = childDiv(container, { cls: 'github-publish-buttons' });

    if (this.step > 1) {
      const backBtn = childEl(nav, 'button', { text: 'Back' });
      backBtn.addEventListener('click', () => {
        this.step = (this.step - 1) as WizardStep;
        this.render();
      });
    }

    const nextBtn = childEl(nav, 'button', {
      text: this.step === 4 ? 'Publish' : 'Next',
      cls: 'mod-cta',
    });

    if (this.step === 4) {
      nextBtn.disabled = this.isPublishing;
    }

    nextBtn.addEventListener('click', () => {
      this.submitWizard();
    });
  }

  private advanceStep(): void {
    if (!this.validateStep()) {
      return;
    }
    if (this.step === 4) {
      void this.publish();
      return;
    }
    if (this.step === 1) {
      this.applyFolderSuggestions();
    } else if (this.step === 2 && !this.repoNameEdited) {
      this.repoName = suggestRepoNameFromSiteName(this.siteName);
    }
    this.step = (this.step + 1) as WizardStep;
    this.render();
  }

  private async advanceFromRepoStep(): Promise<void> {
    if (!this.validateStep()) {
      return;
    }
    const available = await this.ensureRepoNameAvailable();
    if (!available) {
      return;
    }
    this.step = 4;
    this.render();
  }

  private validateStep(): boolean {
    switch (this.step) {
      case 1: {
        const folderPath = this.contentFolder;
        if (folderPath !== '' && !folderPath.trim()) {
          new Notice('Enter a vault folder path.');
          return false;
        }
        const folder =
          folderPath === ''
            ? this.app.vault.getRoot()
            : this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) {
          new Notice('Folder not found in vault.');
          return false;
        }
        return true;
      }
      case 2:
        if (!this.siteName.trim()) {
          new Notice('Enter a site name.');
          return false;
        }
        return true;
      case 3:
        if (!this.repoName.trim()) {
          new Notice('Enter or select a repository name.');
          return false;
        }
        if (this.repoMode === 'create' && !CREATE_REPO_NAME_PATTERN.test(this.repoName)) {
          new Notice('Repository name must be lowercase alphanumeric with hyphens.');
          return false;
        }
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  }

  private publish(): void {
    const token = this.plugin.settings.accessToken;
    const username = this.plugin.settings.githubUsername;
    if (!token || !username) return;

    this.isPublishing = true;

    const config: SetupConfig = {
      siteName: this.siteName.trim(),
      contentFolder: this.contentFolder.trim(),
      repoMode: this.repoMode,
      repoName: this.repoName.trim(),
    };

    saveSetupConfig(this.plugin, config);
    this.close();
    startPublish(this.plugin, config);
  }
}
