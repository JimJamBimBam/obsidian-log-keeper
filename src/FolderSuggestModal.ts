import { App, TFolder, FuzzySuggestModal } from "obsidian";

type StringCallback = (str: string) => void

/** 
* Uses the Obsidian class, 'SuggestModal<T>' to create a selectable list of all folder paths (as strings) in the vault.
* @author James Sonneveld 
* @link https://github.com/JimJamBimBam
* @param {App} app The instance of the obsidian app.
* @param {StringCallback} callback A callback function that is called on items in the SuggestModal when a user makes a selection.
*/
export class FolderSuggestModal extends FuzzySuggestModal<string> {
	
	private callback: StringCallback

	constructor(app: App, callback: StringCallback) {
		super(app)
		this.callback = callback
	}

	getItems(): string[] {
		return this.getFolderNames()
	}
	
	getItemText(item: string): string {
		return item
	}
	
	onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.callback(item)
	}

	/** 
	* Goes through the current Obsidian vault and collects the paths of all folders leading back to root.
	* @returns {string[]} Returns an array of all folders within the vault as paths.
	*/
	private getFolderNames(): string[] {
		const folders: string[] = []
		const root = this.app.vault.getRoot()
		this.collectFolderNames(root, folders)
		return folders
	}

	/** 
	* Recursive function to collect the paths for the given folder.
	* If the folder has a child folder, it will call this method again.
	* @param {TFolder} folder The current folder that the path will come from.
	* @param {string[]} list The list that holds all the folder paths.
	* @returns {void} Input list is modified (appended to). As such, there is no need for a return.
	*/
	private collectFolderNames(folder: TFolder, list: string[]) {
		folder.children.forEach((child) => {
			if (child instanceof TFolder) {
				list.push(child.path)
				this.collectFolderNames(child, list)
			}
		})
	}
}
