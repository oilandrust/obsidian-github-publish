import { App, Modal, Notice } from 'obsidian';
import { PublishedSite } from '../settings';
import { GitHubPublishHost } from '../pluginHost';
import { childDiv, childEl } from './dom';
import {
  publishBundleContextFromSite,
  resolveDefaultQuartzConfig,
} from '../publish/bundleToolchain';
import {
  readSiteConfigOverride,
  removeSiteConfigOverride,
  writeSiteConfigOverride,
} from '../publish/siteConfig';

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

    const nav = childDiv(contentEl, { cls: 'github-publish-buttons' });

    const cancelBtn = childEl(nav, 'button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const resetBtn = childEl(nav, 'button', { text: 'Reset to default' });
    resetBtn.addEventListener('click', () => {
      editor.value = this.defaultConfig;
    });

    const saveBtn = childEl(nav, 'button', { text: 'Save', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => {
      void this.save(editor.value);
    });
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
