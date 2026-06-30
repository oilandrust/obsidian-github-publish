import { App, TFolder } from 'obsidian';
import { childDiv, childEl, childSpan } from './dom';
import { elEmpty } from './element';
import { getVaultRootFolder, listSubfoldersSorted } from '../utils/vault';

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
    elEmpty(this.container);
    const tree = childDiv(this.container, { cls: 'github-publish-folder-tree' });

    const root = getVaultRootFolder(this.app.vault);
    const topFolders = listSubfoldersSorted(root);

    for (const folder of topFolders) {
      this.renderFolder(tree, folder, 0);
    }

    if (topFolders.length === 0) {
      childEl(tree, 'p', {
        cls: 'github-publish-folder-tree-empty',
        text: 'No folders found in this vault.',
      });
    }
  }

  private renderFolder(parent: HTMLElement, folder: TFolder, depth: number): void {
    const subfolders = listSubfoldersSorted(folder);
    const hasSubfolders = subfolders.length > 0;
    const isExpanded = this.options.expandedPaths.has(folder.path);
    const isSelected = this.options.selectedPath === folder.path;

    const row = childDiv(parent, {
      cls: `github-publish-folder-row${isSelected ? ' is-selected' : ''}`,
    });
    row.style.setProperty('--folder-depth', String(depth));

    const toggle = childSpan(row, { cls: 'github-publish-folder-toggle' });
    if (hasSubfolders) {
      const btn = childEl(toggle, 'button', {
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

    const label = childSpan(row, {
      cls: 'github-publish-folder-label',
      text: folder.name,
    });
    label.addEventListener('click', () => {
      this.options.onSelect(folder.path);
    });

    if (hasSubfolders && isExpanded) {
      const children = childDiv(parent, { cls: 'github-publish-folder-children' });
      for (const child of subfolders) {
        this.renderFolder(children, child, depth + 1);
      }
    }
  }
}
