import { App, Modal, Notice } from 'obsidian';
import { PublishedSite } from '../settings';
import { GitHubPublishHost } from '../pluginHost';
import { childDiv, childEl } from './dom';
import {
  publishBundleContextFromSite,
  resolveDefaultQuartzConfig,
} from '../publish/bundleToolchain';
import {
  ensureSiteConfigOnDisk,
  readSiteConfigOverride,
  removeSiteConfigOverride,
  revealInFileManagerLabel,
  openParentFolderInFileManager,
  writeSiteConfigOverride,
} from '../publish/siteConfig';

const QUARTZ_CONFIGURATION_URL = 'https://quartz.jzhao.xyz/configuration';

export class QuartzConfigModal extends Modal {
  private readonly defaultConfig: string;

  constructor(
    app: App,
    private readonly plugin: GitHubPublishHost,
    private readonly site: PublishedSite,
    private readonly onChanged?: () => void,
  ) {
    super(app);
    this.defaultConfig = resolveDefaultQuartzConfig(publishBundleContextFromSite(this.site));
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('github-publish-modal');

    childEl(contentEl, 'h2', { text: 'Edit Quartz configuration' });
    childEl(contentEl, 'p', {
      text: `Customize quartz.config.yaml for "${this.site.siteName}". Saved changes are uploaded the next time you publish changes for this site.`,
    });

    const docsRow = childDiv(contentEl, { cls: 'github-publish-config-docs' });
    const docsLink = childEl(docsRow, 'a', {
      cls: 'github-publish-config-docs-link',
      href: QUARTZ_CONFIGURATION_URL,
      text: 'Learn how to configure Quartz here',
    });
    docsLink.target = '_blank';
    docsLink.rel = 'noopener noreferrer';

    const editor = childEl(contentEl, 'textarea', {
      cls: 'github-publish-config-editor',
    });
    editor.spellcheck = false;
    editor.disabled = true;
    editor.value = 'Loading…';

    void readSiteConfigOverride(this.plugin.app, this.site.id)
      .then((override) => {
        editor.value = override ?? this.defaultConfig;
        editor.disabled = false;
      })
      .catch((error: unknown) => {
        editor.value = this.defaultConfig;
        editor.disabled = false;
        new Notice(
          `Could not read saved config: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    const nav = childDiv(contentEl, { cls: 'github-publish-buttons github-publish-config-nav' });

    const revealBtn = childEl(nav, 'button', {
      text: revealInFileManagerLabel(),
      cls: 'github-publish-config-reveal',
    });
    revealBtn.addEventListener('click', () => {
      void this.revealInFileManager(editor.value);
    });

    const navActions = childDiv(nav, { cls: 'github-publish-config-nav-actions' });

    const cancelBtn = childEl(navActions, 'button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const resetBtn = childEl(navActions, 'button', { text: 'Reset to default' });
    resetBtn.addEventListener('click', () => {
      editor.value = this.defaultConfig;
    });

    const saveBtn = childEl(navActions, 'button', { text: 'Save', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => {
      void this.save(editor.value);
    });
  }

  private async revealInFileManager(content: string): Promise<void> {
    try {
      const absolutePath = await ensureSiteConfigOnDisk(
        this.plugin.app,
        this.site.id,
        content,
      );
      openParentFolderInFileManager(absolutePath);
      this.onChanged?.();
      new Notice(`${revealInFileManagerLabel()}: quartz.config.yaml`);
    } catch (error: unknown) {
      new Notice(
        `Could not reveal config file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async save(content: string): Promise<void> {
    try {
      if (content.trim() === this.defaultConfig.trim()) {
        // Identical to the embedded default — drop the override so publishing uses defaults.
        await removeSiteConfigOverride(this.plugin.app, this.site.id);
        new Notice('Using the default Quartz configuration.');
      } else {
        await writeSiteConfigOverride(this.plugin.app, this.site.id, content);
        new Notice('Quartz configuration saved.');
      }
      this.onChanged?.();
      this.close();
    } catch (error: unknown) {
      new Notice(
        `Could not save config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
