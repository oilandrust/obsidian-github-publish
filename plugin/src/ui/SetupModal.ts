import { App, Modal, Notice, Setting, TFolder } from 'obsidian';
import { listUserRepos } from '../github/repos';
import { GitHubPublishHost } from '../pluginHost';
import { SetupConfig } from '../settings';
import { countFilesInFolder } from '../publish/scanVault';
import { saveSetupConfig, startPublish } from '../publish/startPublish';
import { FolderTree } from './FolderTree';
import { childDiv, childEl } from './dom';

type WizardStep = 1 | 2 | 3 | 4;

export class SetupModal extends Modal {
  private step: WizardStep = 1;
  private siteName = '';
  private contentFolder = '';
  private repoMode: 'create' | 'existing' = 'create';
  private repoName = '';
  private isPublishing = false;
  private expandedFolders = new Set<string>();

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

    const saved = this.plugin.settings.savedSetup;
    this.siteName = saved?.siteName ?? '';
    this.contentFolder = saved?.contentFolder ?? '';
    this.repoMode = saved?.repoMode ?? 'create';
    this.repoName = saved?.repoName ?? '';
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('github-publish-modal');

    childEl(contentEl, 'h2', { text: `GitHub Publish — Setup (step ${String(this.step)}/4)` });

    switch (this.step) {
      case 1:
        this.renderSiteNameStep(contentEl);
        break;
      case 2:
        this.renderFolderStep(contentEl);
        break;
      case 3:
        this.renderRepoStep(contentEl);
        break;
      case 4:
        this.renderConfirmStep(contentEl);
        break;
    }

    this.renderNav(contentEl);
  }

  private renderSiteNameStep(container: HTMLElement): void {
    childEl(container, 'p', {
      text: 'Choose a name for your published site. This appears in the browser tab and site header.',
    });

    new Setting(container)
      .setName('Site name')
      .addText((text) => {
        text.setValue(this.siteName).onChange((value: string) => {
          this.siteName = value;
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
            this.render();
          });
      });

    if (this.repoMode === 'create') {
      new Setting(container)
        .setName('New repository name')
        .setDesc('Lowercase letters, numbers, and hyphens. Will be created as public.')
        .addText((text) => {
          text
            .setValue(this.repoName)
            .onChange((value: string) => {
              this.repoName = value;
            })
            .setPlaceholder('my-notes-site');
        });
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
      childEl(container, 'p', {
        text: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private renderConfirmStep(container: HTMLElement): void {
    const fileCount = this.contentFolder
      ? countFilesInFolder(this.app.vault, this.contentFolder)
      : 0;

    childEl(container, 'p', { text: 'Review your publish settings:' });

    const summary = childEl(container, 'dl', { cls: 'github-publish-summary' });
    this.addSummaryRow(summary, 'Site name', this.siteName);
    this.addSummaryRow(summary, 'Vault folder', this.contentFolder);
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
      if (!this.validateStep()) return;
      if (this.step === 4) {
        void this.publish();
        return;
      }
      this.step = (this.step + 1) as WizardStep;
      this.render();
    });
  }

  private validateStep(): boolean {
    switch (this.step) {
      case 1:
        if (!this.siteName.trim()) {
          new Notice('Enter a site name.');
          return false;
        }
        return true;
      case 2: {
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
      case 3:
        if (!this.repoName.trim()) {
          new Notice('Enter or select a repository name.');
          return false;
        }
        if (this.repoMode === 'create' && !/^[a-z0-9][a-z0-9-]*$/.test(this.repoName)) {
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
