import { SuggestModal, App, TFolder } from "obsidian";

type StringCallback = (str: string) => void

/** 
* Uses the Obsidian class, 'SuggestModal<T>' to create a selectable list of all folder paths (as strings) in the vault.
* @author James Sonneveld 
* @link https://github.com/JimJamBimBam
* @param {App} app The instance of the obsidian app.
* @param {StringCallback} callback A callback function that is called on items in the SuggestModal when a user makes a selection.
*/
export class FolderSuggestModal extends SuggestModal<string> {
	private callback: StringCallback
	private query: string = ''

	constructor(app: App, callback: StringCallback) {
		super(app);
		this.callback = callback;
	}

	/**
	* @param {string} query query is the string input from the user when typing in the SuggestModal input.
	* @returns {string[] | Promise<string[]>} Returns an array of folder paths.
	*/
	getSuggestions(query: string): string[] | Promise<string[]> {
		this.query = query
		const folders: string[] = this.getFolderNames()

		return folders.filter((item) => {
			return item.includes(query)
		})
	}

	/**
	* As well as rendering each string value, 'renderSuggestion' also creates a regular expression
	* to replace the queried term with the same query just with the inline HTML tag 'span' inserted inbetween.
	* The span is given the class name 'query-highlight' found in 'styles.css' to provide a yellow highlight to
	* the text.
	* @param {string} value A string value to display to the user.
	* @param {HTMLElement} el The HTML element that can be used to display 'value' in the FolderSuggestModal. 
	*/
	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value)
		// Only replace when query string is greater than 0 to prevent
		// 'replace' from inserting <span></span> between each character.
		if (this.query.length > 0) {
			const highlightedStr: string = this.applyStyleToSubstringWithin(value, this.query, 'query-highlight');
			el.innerHTML = highlightedStr
		}
	}
	
	/**
	* @param {string} item 
	* @param {MouseEvent | KeyboardEvent} _evt
	*/
	onChooseSuggestion(item: string, _evt: MouseEvent | KeyboardEvent): void {
		this.callback(item)
	}
	
	/**
	* Takes a string value and attempts to match a substring within it's contents.
	* Applies a HTML <span> element across the substring with the supplied CSS class name.
	* @param str Input string to search for substring within.
	* @param subStr Substring to search for.
	* @param cssClassName CSS class name to apply to found substring.
	* @returns {string} Returns the modified string with the span tag inserted between the substring found in the original string.
	*/
	applyStyleToSubstringWithin(str: string, subStr: string, cssClassName: string): string {
		const match: RegExp = new RegExp(`${subStr}`, 'g');
		return str.replace(match, `<span class="${cssClassName}">${subStr}</span>`);
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
