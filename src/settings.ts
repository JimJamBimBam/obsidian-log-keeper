import ModifiedFileListPlugin from "main";
import { PluginSettingTab, App, Setting, Notice } from "obsidian";

// Plugin settings
export interface ModifiedFileListSettings {
    // Boolean to disable/enable per day additions to the 'last modified' property.
    // If enabled, the most recent changes will be used as the last modified for that day.
    oneModificationPerDay: boolean
    // The interval, in seconds, when a new date time value is added to the 'last modified' property.
    // When 'oneModificationPerDay' is set to false, new values will be added everytime there is 
    // a difference in the note AND the time between modifications exceeds or is equal to the updateInterval. 
    updateInterval: number
}

// Minimum update interval is required to prevent spamming of modification values to the YAML property.
const MIN_UPDATE_INTERVAL: number = 60
// Maximum update interval is the number of seconds in a day.
// At that point, setting the 'oneModificationPerDay' boolean would be more beneficial
const MAX_UPDATE_INTERVAL: number = 84600

// Default settings for the plugin
export const DEFAULT_SETTINGS: ModifiedFileListSettings = {
    oneModificationPerDay: true,
    updateInterval: 60
}

export class ModifiedFileListTab extends PluginSettingTab {
	// Needs a reference to the plugin to be able to apply settings.
	plugin: ModifiedFileListPlugin
	private warning_msg: string = ""

	constructor(app: App, plugin: ModifiedFileListPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this

		// The 'root' element of the settings tab.
		containerEl.empty()

		// ONE MODIFICATON PER DAY
		new Setting(containerEl)
			.setName("Toggle one modification per day")
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
					this.display()
				})
			})

		// UPDATE INTERVAL
		new Setting(containerEl)
			.setName('Update interval (in seconds)')
			.setDesc(`
					The amount of time between the last modification and the most recent modification before a new value is added
					to the 'last-modified' list property.
					A high update interval should be set otherwise, any single change will result in the addition of a new property value.
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
