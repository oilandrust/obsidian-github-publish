import { App, TFolder } from 'obsidian';

export interface FolderTreeOptions {
  selectedPath: string;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggleExpand: (path: string) => void;
}

export class FolderTree {
  constructor(
    private readonly app: App,
    private readonly container: HTMLElement,
    private readonly options: FolderTreeOptions,
  ) {}

  render(): void {
    this.container.empty();
    const tree = this.container.createDiv({ cls: 'github-publish-folder-tree' });

    const root = this.app.vault.getRoot();
    const topFolders = root.children
      .filter((child): child is TFolder => child instanceof TFolder)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    for (const folder of topFolders) {
      this.renderFolder(tree, folder, 0);
    }

    if (topFolders.length === 0) {
      tree.createEl('p', {
        cls: 'github-publish-folder-tree-empty',
        text: 'No folders found in this vault.',
      });
    }
  }

  private renderFolder(parent: HTMLElement, folder: TFolder, depth: number): void {
    const subfolders = folder.children.filter((child): child is TFolder => child instanceof TFolder);
    const hasSubfolders = subfolders.length > 0;
    const isExpanded = this.options.expandedPaths.has(folder.path);
    const isSelected = this.options.selectedPath === folder.path;

    const row = parent.createDiv({
      cls: `github-publish-folder-row${isSelected ? ' is-selected' : ''}`,
    });
    row.style.setProperty('--folder-depth', String(depth));

    const toggle = row.createSpan({ cls: 'github-publish-folder-toggle' });
    if (hasSubfolders) {
      const btn = toggle.createEl('button', {
        type: 'button',
        cls: 'github-publish-folder-chevron',
        text: isExpanded ? '▾' : '▸',
      });
      btn.setAttribute('aria-label', isExpanded ? 'Collapse folder' : 'Expand folder');
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.options.onToggleExpand(folder.path);
      });
    }

    const label = row.createSpan({
      cls: 'github-publish-folder-label',
      text: folder.name,
    });
    label.addEventListener('click', () => {
      this.options.onSelect(folder.path);
    });

    if (hasSubfolders && isExpanded) {
      const children = parent.createDiv({ cls: 'github-publish-folder-children' });
      for (const child of subfolders.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      )) {
        this.renderFolder(children, child, depth + 1);
      }
    }
  }
}
