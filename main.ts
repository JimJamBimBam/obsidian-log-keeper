import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, MetadataCache, MarkdownFileInfo, TFile, FrontMatterCache } from 'obsidian'

// Minimum update interval is required to prevent spamming of modification values to the YAML property.
const MIN_UPDATE_INTERVAL: number = 60
// Maximum update interval is the number of seconds in a day.
// At that point, setting the 'oneModificationPerDay' boolean would be more beneficial
const MAX_UPDATE_INTERVAL: number = 84600

// Remember to rename these classes and interfaces!

// The 'class/file' of what the settings for the plugin cotain.
interface ModifiedFileListSettings {
	// Boolean to disable/enable per day additions to the 'last modified' property.
	// If enabled, the most recent changes will be used as the last modified for that day.
	oneModificationPerDay: boolean
	// The interval, in seconds, when a new date time value is added to the 'last modified' property.
	// When 'oneModificationPerDay' is set to false, new values will be added everytime there is 
	// a difference in the note AND the time between modifications exceeds or is equal to the updateInterval. 
	updateInterval: number
}

// Default settings for the plugin
const DEFAULT_SETTINGS: ModifiedFileListSettings = {
	oneModificationPerDay: true,
	updateInterval: 2
}

export default class ModifiedFileListPlugin extends Plugin {
	settings: ModifiedFileListSettings

	async onload() {
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

		// This setting deals with the boolean that controls if modifications should be added one per day or
		// shoudld be added multiple times a day (dependent on the update interval setting.) 
		new Setting(containerEl)
			.setName("Toggle One Modification Per Day")
			.setDesc(`
				Toggle between tracking modifications made to notes per day or by the interval set by Update Interval.
				The most recent modification on the day will be used for that day.
				Setting this to true will also disable Update Interval.
				`)
			.addToggle((toggle) => {
				toggle.setTooltip('Toggle between one tracking per day modifications or not.')
				toggle.setValue(this.plugin.settings.oneModificationPerDay)
				toggle.onChange(async (value) => {
					this.plugin.settings.oneModificationPerDay = value
					await this.plugin.saveSettings()
				})
			})
		
		// The setting that deals with the interval between the last modification property being added and the new one to be added.
		new Setting(containerEl)
				.setName('Update Interval (In Seconds)')
				.setDesc(`The amount of time between the last modification and the most recent modification before a new value is added
					to the 'last-modified' list property.
					A high update interval should be set otherwise, any single chagne will result in the addition of a new property value.`)
				.addText((textfield) => {
					textfield.setPlaceholder("E.g. '10'")
					// Anything that is not a valid number is returned as NaN (Not a Number)
					// This is checked for and the min is given back instead.
					// Allows for simple check when trying to change the updateInterval
					textfield.inputEl.inputMode = "numeric"
					textfield.setValue(String(this.plugin.settings.updateInterval))
					textfield.onChange(async (value) => {
						if (isNaN(Number(value)) || Number(value) < MIN_UPDATE_INTERVAL)
							this.plugin.settings.updateInterval = MIN_UPDATE_INTERVAL
						else if (Number(value) > MAX_UPDATE_INTERVAL)
							this.plugin.settings.updateInterval = MAX_UPDATE_INTERVAL
						else
							this.plugin.settings.updateInterval = Number(value)

						await this.plugin.saveSettings()
					})
				})
	}
}
