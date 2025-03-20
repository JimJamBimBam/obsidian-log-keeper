import { App, Editor, MarkdownView, Modal, Notice, Plugin, MetadataCache, MarkdownFileInfo, TFile, FrontMatterCache, moment, CachedMetadata } from 'obsidian'
import { ModifiedFileListTab, DEFAULT_SETTINGS, ModifiedFileListSettings } from 'src/settings'
import { Moment } from 'moment'

export default class ModifiedFileListPlugin extends Plugin {
	settings: ModifiedFileListSettings

	async onload() {
		// Logging debugging information on load.
		console.log(`Activating: ${this.manifest.name}\n
			 Version: ${this.manifest.version}
			 Author: ${this.manifest.author}
			 Author URL: ${this.manifest.authorUrl}`
			)
		
		await this.loadSettings()
		
		// Command added for debugging purposes and to test various Obsidian functions.
		this.addCommand({
			id: 'debug-print-metadata',
			name: 'DEBUG: Print Metadata',
			editorCallback: (e, view) => {
				new MetadataPrintModal(this.app, view, this.settings).open()
			}
		})

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ModifiedFileListTab(this.app, this))

		// This event is called when text is changed in a note.
		this.registerEvent(this.app.workspace.on('editor-change', (_, info) => {
			if (info.file instanceof TFile) {
				this.updateFrontmatter(info.file)
			}
		}))
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	/** 
	Will attempt to update the 'last-modified' property of the frontmatter of the given file.
	@param {TFile} file - The file that is having it's frontmatter updated. 
	*/
	updateFrontmatter(file: TFile): void {
		// moment() will return the current time to use later.
		const currentMoment: Moment = moment()
		// the cache where the YAML metadata can be found.
		const cache: CachedMetadata | null = this.app.metadataCache.getFileCache(file)
		// previous moment will be undefined unless one can be found in the frontmatter.
		let previousMoment: Moment
		// set to Infinity to start with. Will change if the current and previous moment can be found.
		// at that point, a difference can be made and should be greater than 0 but less than Infinity.
		let secondsSinceLastUpdate: number = Infinity
		const isAppendArray: boolean = !this.settings?.oneModificationPerDay

		// We have a property in the frontmatter of the file, we can use it's value.
		if (cache?.frontmatter?.['last-modified'] != null) {
			let last_modified_list: Array<any> = cache.frontmatter['last-modified']
			let last_element_index: number = last_modified_list.length - 1
			let previousEntry = cache.frontmatter['last-modified'][last_element_index]
			previousMoment = moment(previousEntry, 'YYYY-MM-DDTHH:mm:ss')
			
			if (previousMoment.isValid()) {
				secondsSinceLastUpdate = currentMoment.diff(previousMoment, 'seconds')
			}
		}
		
		// The new entry is created here when the seconds since last modification is greater than the update interval.
		if (secondsSinceLastUpdate > this.settings.updateInterval) {
			let newEntry: string = currentMoment.format('yyyy-MM-DDTHH:mm:ss')
			let newEntries: Array<string> | null = cache?.frontmatter?.['last-modified']
			
			newEntries?.push(newEntry)

			this.app.fileManager.processFrontMatter(file, frontmatter => {
				// Update the modified date field
				frontmatter['last-modified'] = newEntries
			})
		}
	}
}

class MetadataPrintModal extends Modal {
	metadata: MetadataCache
	_test_metadata?: FrontMatterCache
	view: MarkdownView | MarkdownFileInfo
	settings: ModifiedFileListSettings
	
	constructor(app: App, view: MarkdownView | MarkdownFileInfo, settings: ModifiedFileListSettings) {
		super(app)
		this.view = view
		this.settings = settings

		if (app.metadataCache.getFileCache(view.file as TFile)) {
			this._test_metadata = app.metadataCache.getFileCache(view.file as TFile)?.frontmatter
		}
	}

	onOpen(): void {
		const {contentEl} = this
		for(const property in this._test_metadata) {
			const text = `${property}: ${this._test_metadata[property]}\n`
			contentEl.createEl('div', {text: text})
		}
		contentEl.createEl('div', {text: String(this.settings.oneModificationPerDay)})
		contentEl.createEl('div', {text: String(this.settings.updateInterval)})
	}

	onClose(): void {
		const {contentEl} = this
		contentEl.empty()
	}
}
