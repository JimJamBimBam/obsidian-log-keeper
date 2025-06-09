import LogKeeperPlugin from "main";
import { PluginSettingTab, App, Setting, Notice } from "obsidian";
import { FolderSuggestModal } from "./FolderSuggestModal";

// Plugin settings
export interface LogKeeperSettings {
    // Boolean to disable/enable per day additions to the 'last modified' property.
    // If enabled, the most recent changes will be used as the last modified for that day.
    oneModificationPerDay: boolean
    // The interval, in seconds, when a new date time value is added to the 'last modified' property.
    // When 'oneModificationPerDay' is set to false, new values will be added everytime there is 
    // a difference in the note AND the time between modifications exceeds or is equal to the updateInterval. 
    updateInterval: number
	ignoredFolders: Array<string>
}

// Minimum update interval is required to prevent spamming of modification values to the YAML property.
const MIN_UPDATE_INTERVAL: number = 60
// Maximum update interval is the number of seconds in a day.
// At that point, setting the 'oneModificationPerDay' boolean would be more beneficial
const MAX_UPDATE_INTERVAL: number = 84600

// Default settings for the plugin
export const DEFAULT_SETTINGS: LogKeeperSettings = {
    oneModificationPerDay: true,
    updateInterval: 60,
	ignoredFolders: new Array()
}

export class LogKeeperTab extends PluginSettingTab {
	// Needs a reference to the plugin to be able to apply settings.
	plugin: LogKeeperPlugin
	private warning_msg: string = ""

	constructor(app: App, plugin: LogKeeperPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		
		const suggestions: FolderSuggestModal = new FolderSuggestModal(this.app, async (folderPath) => {
			if (!this.plugin.settings.ignoredFolders.includes(folderPath))
				this.plugin.settings.ignoredFolders.push(folderPath)
				await this.plugin.saveSettings()
				this.display()
		})

		// The 'root' element of the settings tab.
		containerEl.empty()

		// ONE MODIFICATON PER DAY
		new Setting(containerEl)
			.setClass('log-keeper-setting')
			.setName("Toggle per day logging")
			.setDesc(`
				If toggled on, notes will only track the most recent modification made on that day, overwriting any previous modifications made for the same day.
				When toggled off, modifications will be tracked based on the update interval.
				`)
			.addToggle((toggle) => {
				toggle.setTooltip('Toggle between one tracking per day modifications or not.')
				toggle.setValue(this.plugin.settings.oneModificationPerDay)
				toggle.onChange(async (value) => {
					this.plugin.settings.oneModificationPerDay = value
					await this.plugin.saveSettings()
					this.display()
				})
			})

		// UPDATE INTERVAL
		new Setting(containerEl)
			.setClass('log-keeper-setting')
			.setName('Update interval')
			.setDesc(`
					The amount of time (in seconds) between the last modification and the most recent modification before a new value is added
					to the 'last-modified' list property.
					The minimum amount of time between updates is fixed at 60 seconds to prevent excessive updates to the 'last-modified' property.
					`)
			.addText((textfield) => {
				// Try not limit input for user on computer but will assist those on mobile.
				textfield.inputEl.inputMode = "numeric"
				textfield.setValue(this.plugin.settings.updateInterval.toString(10))
				textfield.onChange(async (value) => {
					let valueNumber: number = Number(value)

					// Validate input here, ignoring erroneous inputs (non-number characters)
					// and values that extend past the min and max.
					if (isNaN(valueNumber)) {
						this.warning_msg = `${this.plugin.manifest.name} - '${value}' is not a valid value for 'update interval'.\nSetting to previous value.`
						return
					}
					else if (valueNumber < MIN_UPDATE_INTERVAL) {
						this.warning_msg = `${this.plugin.manifest.name} - '${valueNumber}' is too low for 'update interval'.\nSetting to min value: ${MIN_UPDATE_INTERVAL}`
						valueNumber = MIN_UPDATE_INTERVAL
					}
					else if (valueNumber > MAX_UPDATE_INTERVAL) {
						this.warning_msg = `${this.plugin.manifest.name} - '${valueNumber}' is too high for 'update interval'.\nSetting to max value: ${MAX_UPDATE_INTERVAL}`
						valueNumber = MAX_UPDATE_INTERVAL
					}

					this.plugin.settings.updateInterval = valueNumber
					await this.plugin.saveSettings()
				})
			})
			.setDisabled(this.plugin.settings.oneModificationPerDay)


		// IGNORED FOLDERS
		new Setting(containerEl)
			.setClass('log-keeper-setting')
			.setName("Ignored folders")
			.setDesc(`
				Ignored folders will prevent notes within them from being stamped with a date and time.
				`)
			.addButton((button) => {
				button.onClick(() => suggestions.open())
				button.setButtonText("Add folder to ignore")
			})
		
			this.plugin.settings.ignoredFolders.forEach((element, index) => {
				new Setting(containerEl)
					.setName(element)
					.setClass('log-keeper-setting-inner')
					.addExtraButton(extraButton => extraButton
						.setIcon('cross')
						.setTooltip('Delete')
						.onClick(async () => {
							this.plugin.settings.ignoredFolders.splice(index, 1)
							await this.plugin.saveSettings()
							this.display()
						})
					)
			})
	}

	hide(): void {
		if (this.warning_msg.length > 0) {
			this.printWarning();
		}
	}
	
	// For plugin only.
	// Print warnings to user when putting in the wrong inputs for settings.
	private printWarning() {
		new Notice(this.warning_msg, 5000);
		// Reset the warning message
		this.warning_msg = '';
	}
}
