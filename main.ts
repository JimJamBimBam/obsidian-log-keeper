import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, MetadataCache, MarkdownFileInfo, TFile, FrontMatterCache } from 'obsidian'

// Remember to rename these classes and interfaces!

interface ModifiedFileListSettings {
	mySetting: string
	mySecondSetting: string
}

const DEFAULT_SETTINGS: ModifiedFileListSettings = {
	mySetting: 'default',
	mySecondSetting: 'default'
}

export default class ModifiedFileListPlugin extends Plugin {
	settings: ModifiedFileListSettings

	async onload() {
		await this.loadSettings()

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!')
		})
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class')

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem()
		statusBarItemEl.setText('Status Bar Text')

		// Command added for debugging purposes and to test various Obsidian functions.
		this.addCommand({
			id: 'debug-print-metadata',
			name: 'DEBUG: Print Metadata',
			editorCallback: (e, view) => {
				new MetadataPrintModal(this.app, view).open()
			}
		})

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new ModifiedFileListModal(this.app).open()
			}
		})
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection())
				editor.replaceSelection('Sample Editor Command')
			}
		})
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView)
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new ModifiedFileListModal(this.app).open()
					}

					// This command will only show up in Command Palette when the check function returns true
					return true
				}
			}
		})

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ModifiedFileListTab(this.app, this))

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt)
		})

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000))
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}

class MetadataPrintModal extends Modal {
	metadata: MetadataCache
	_test_metadata?: FrontMatterCache
	view: MarkdownView | MarkdownFileInfo
	
	constructor(app: App, view: MarkdownView | MarkdownFileInfo) {
		super(app)
		this.view = view

		if (app.metadataCache.getFileCache(view.file as TFile)) {
			this._test_metadata = app.metadataCache.getFileCache(view.file as TFile)?.frontmatter
		}
	}

	onOpen(): void {
		const {contentEl} = this
		for(var property in this._test_metadata) {
			let prop = property
			let text = `${prop}: ${this._test_metadata[property]}\n`
			contentEl.createEl('div', {text: text})
		}
	}

	onClose(): void {
		const {contentEl} = this
		contentEl.empty()
	}
}

class ModifiedFileListModal extends Modal {
	constructor(app: App) {
		super(app)
	}

	onOpen() {
		const {contentEl} = this
		contentEl.setText('Woah!')
	}

	onClose() {
		const {contentEl} = this
		contentEl.empty()
	}
}

// The class for the settings tab that can be found in 'Settings > Community Plugins > YAML Metadata: Add Last Modified Property'
class ModifiedFileListTab extends PluginSettingTab {
	// Needs a reference to the plugin to be able to apply settings.
	plugin: ModifiedFileListPlugin

	constructor(app: App, plugin: ModifiedFileListPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const {containerEl} = this
		
		// The 'root' element of the settings tab.
		containerEl.empty()

		// The first setting.
		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value
					await this.plugin.saveSettings()
				}))
		
		// The second setting.
		new Setting(containerEl)
				.setName('Setting #2')
				.setDesc('It\'s another secret')
				.addText(text => text
					.setPlaceholder('Enter another secret')
					.setValue(this.plugin.settings.mySecondSetting)
					.onChange(async (value) => {
						this.plugin.settings.mySecondSetting = value
						await this.plugin.saveSettings()
					}))
	}
}
