import { App, FuzzySuggestModal } from 'obsidian';
import { PublishedSite } from '../settings';

export class SitePickerModal extends FuzzySuggestModal<PublishedSite> {
  constructor(
    app: App,
    private readonly sites: PublishedSite[],
    private readonly onChoose: (site: PublishedSite) => void,
  ) {
    super(app);
  }

  getItems(): PublishedSite[] {
    return this.sites;
  }

  getItemText(site: PublishedSite): string {
    return `${site.siteName} (${site.owner}/${site.repo})`;
  }

  onChooseItem(site: PublishedSite): void {
    this.onChoose(site);
  }
}
