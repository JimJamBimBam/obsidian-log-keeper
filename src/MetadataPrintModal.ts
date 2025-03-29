import { Modal, MetadataCache, FrontMatterCache, MarkdownView, MarkdownFileInfo, App, TFile } from 'obsidian';
import { ModifiedFileListSettings } from 'src/settings';

export class MetadataPrintModal extends Modal {
	metadata: MetadataCache;
	_test_metadata?: FrontMatterCache;
	view: MarkdownView | MarkdownFileInfo;
	settings: ModifiedFileListSettings;

	constructor(app: App, view: MarkdownView | MarkdownFileInfo, settings: ModifiedFileListSettings) {
		super(app);
		this.view = view;
		this.settings = settings;

		if (app.metadataCache.getFileCache(view.file as TFile)) {
			this._test_metadata = app.metadataCache.getFileCache(view.file as TFile)?.frontmatter;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		for (const property in this._test_metadata) {
			const text = `${property}: ${this._test_metadata[property]}\n`;
			contentEl.createEl('div', { text: text });
		}
		contentEl.createEl('div', { text: String(this.settings.oneModificationPerDay) });
		contentEl.createEl('div', { text: String(this.settings.updateInterval) });
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
