import { SuggestModal, App, TFolder } from "obsidian";

export class FolderSuggestModal extends SuggestModal<string> {
	private callback: (item: string) => void;

	constructor(app: App, callback: (item: string) => void) {
		super(app);
		this.callback = callback;
	}

	getSuggestions(query: string): string[] | Promise<string[]> {
		return this.getFolderNames();
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.callback(item);
	}

	private getFolderNames(): string[] {
		const folders: string[] = [];
		const root = this.app.vault.getRoot();
		this.collectFolderNames(root, folders);
		return folders;
	}

	private collectFolderNames(folder: TFolder, list: string[]) {
		folder.children.forEach((child) => {
			if (child instanceof TFolder) {
				list.push(child.path);
				this.collectFolderNames(child, list);
			}
		});
	}
}
