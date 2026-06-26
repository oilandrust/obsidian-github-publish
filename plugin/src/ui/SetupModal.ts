import { App, Modal, Notice, Setting, TFolder } from 'obsidian';
import { connectGitHub } from '../github/connect';
import { listUserRepos } from '../github/repos';
import GitHubPublishPlugin from '../../main';
import { SetupConfig } from '../settings';
import { countFilesInFolder } from '../publish/scanVault';
import { saveSetupConfig, startPublish } from '../publish/startPublish';
import { FolderTree } from './FolderTree';

type WizardStep = 1 | 2 | 3 | 4 | 5;

export class SetupModal extends Modal {
  private step: WizardStep = 1;
  private siteName = '';
  private contentFolder = '';
  private repoMode: 'create' | 'existing' = 'create';
  private repoName = '';
  private deviceCodeVisible = false;
  private userCode = '';
  private isPublishing = false;
  private expandedFolders = new Set<string>();

  constructor(
    app: App,
    private readonly plugin: GitHubPublishPlugin,
  ) {
    super(app);
  }

  onOpen(): void {
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

    contentEl.createEl('h2', { text: `GitHub Publish — Setup (step ${this.step}/5)` });

    switch (this.step) {
      case 1:
        this.renderSiteNameStep(contentEl);
        break;
      case 2:
        this.renderFolderStep(contentEl);
        break;
      case 3:
        this.renderAuthStep(contentEl);
        break;
      case 4:
        this.renderRepoStep(contentEl);
        break;
      case 5:
        this.renderConfirmStep(contentEl);
        break;
    }

    this.renderNav(contentEl);
  }

  private renderSiteNameStep(container: HTMLElement): void {
    container.createEl('p', {
      text: 'Choose a name for your published site. This appears in the browser tab and site header.',
    });

    new Setting(container)
      .setName('Site name')
      .addText((text) => {
        text.setValue(this.siteName).onChange((value) => {
          this.siteName = value;
        });
        text.inputEl.focus();
      });
  }

  private renderFolderStep(container: HTMLElement): void {
    container.createEl('p', {
      text: 'Select the vault folder to publish. Its contents will be copied to content/ in your GitHub repository.',
    });

    if (this.contentFolder) {
      container.createEl('p', {
        cls: 'github-publish-selected-folder',
        text: `Selected: ${this.contentFolder || '(vault root)'}`,
      });
    }

    const treeHost = container.createDiv({ cls: 'github-publish-folder-tree-host' });
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

  private renderAuthStep(container: HTMLElement): void {
    if (this.plugin.settings.accessToken && this.plugin.settings.githubUsername) {
      container.createEl('p', {
        text: `Connected as ${this.plugin.settings.githubUsername}`,
      });
      new Setting(container).addButton((btn) =>
        btn.setButtonText('Disconnect').onClick(async () => {
          this.plugin.settings.accessToken = null;
          this.plugin.settings.githubUsername = null;
          await this.plugin.saveSettings();
          this.render();
        }),
      );
      return;
    }

    container.createEl('p', {
      text: 'Connect your GitHub account using the device authorization flow (scopes: repo, workflow).',
    });

    if (this.deviceCodeVisible) {
      if (this.userCode) {
        container.createEl('p', { text: 'Enter this code on GitHub:' });
        container.createEl('div', { cls: 'github-publish-device-code', text: this.userCode });
        container.createEl('p', { text: 'Waiting for authorization…' });
      } else {
        container.createEl('p', { text: 'Requesting device code…' });
      }
    }

    new Setting(container).addButton((btn) => {
      btn.setButtonText(this.deviceCodeVisible ? 'Restart login' : 'Connect to GitHub');
      btn.setCta();
      btn.setDisabled(this.deviceCodeVisible && !this.userCode);
      btn.onClick(() => void this.startDeviceFlow());
    });
  }

  private renderRepoStep(container: HTMLElement): void {
    container.createEl('p', { text: 'Create a new repository or use an existing empty one.' });

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
            .onChange((value) => {
              this.repoName = value;
            })
            .setPlaceholder('my-notes-site');
        });
    } else {
      container.createEl('p', { text: 'Loading repositories…' });
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
          dropdown.setValue(this.repoName).onChange((value) => {
            this.repoName = value;
          });
        });
    } catch (error) {
      container.createEl('p', {
        text: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private renderConfirmStep(container: HTMLElement): void {
    const fileCount = this.contentFolder
      ? countFilesInFolder(this.app.vault, this.contentFolder)
      : 0;

    container.createEl('p', { text: 'Review your publish settings:' });

    const summary = container.createEl('dl', { cls: 'github-publish-summary' });
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
    dl.createEl('dt', { text: label });
    dl.createEl('dd', { text: value || '—' });
  }

  private renderNav(container: HTMLElement): void {
    const nav = container.createDiv({ cls: 'github-publish-buttons' });

    if (this.step > 1) {
      const backBtn = nav.createEl('button', { text: 'Back' });
      backBtn.addEventListener('click', () => {
        this.step = (this.step - 1) as WizardStep;
        this.render();
      });
    }

    const nextBtn = nav.createEl('button', {
      text: this.step === 5 ? 'Publish' : 'Next',
      cls: 'mod-cta',
    });

    if (this.step === 5) {
      nextBtn.disabled = this.isPublishing;
    }

    nextBtn.addEventListener('click', () => {
      if (!this.validateStep()) return;
      if (this.step === 5) {
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
        if (!this.plugin.settings.accessToken) {
          new Notice('Connect to GitHub first.');
          return false;
        }
        return true;
      case 4:
        if (!this.repoName.trim()) {
          new Notice('Enter or select a repository name.');
          return false;
        }
        if (this.repoMode === 'create' && !/^[a-z0-9][a-z0-9-]*$/.test(this.repoName)) {
          new Notice('Repository name must be lowercase alphanumeric with hyphens.');
          return false;
        }
        return true;
      case 5:
        return true;
      default:
        return true;
    }
  }

  private async startDeviceFlow(): Promise<void> {
    try {
      this.deviceCodeVisible = true;
      this.render();
      const user = await connectGitHub(this.plugin, {
        onUserCode: (code) => {
          this.userCode = code;
          this.render();
        },
        onPending: () => {
          this.render();
        },
      });
      new Notice(`Connected as ${user.login}`);
      this.deviceCodeVisible = false;
      this.userCode = '';
      this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
      this.deviceCodeVisible = false;
      this.render();
    }
  }

  private async publish(): Promise<void> {
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
