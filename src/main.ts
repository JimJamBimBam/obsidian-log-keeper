import { Plugin, TFile, moment, FrontMatterCache } from 'obsidian'
import { ModifiedFileListTab, DEFAULT_SETTINGS, ModifiedFileListSettings } from './settings'
import { Moment } from 'moment'

type YAMLProperty = {
	property: string | undefined,
	value: any | undefined
}

/**
 * @author James Sonneveld
 * @link https://github.com/JimJamBimBam
 */
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

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ModifiedFileListTab(this.app, this))

		// 'modify' event of  'this.app.vault' appears to be less buggy than
		// 'editor-change' event in 'this.app.workspace'.
		// If warning about 'file merging' happening too much,
		// will need to consider another method of handling changes to files
		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (file instanceof TFile) {
				this.updateFrontmatter(file)
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
	* Will attempt to update the 'last-modified' property of the frontmatter of the given file.
	* @author James Sonneveld https://github.com/JimJamBimBam
	* @param {TFile} file - The file that is having it's frontmatter updated.
	* @returns {Promise<void>} Nothing
	*/
	async updateFrontmatter(file: TFile): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (yamlData) => {
			if (this.fileWithinIgnoredFolders(file)) {
				// The folder the file is in is part of the exclusion list and should be ignored.
				return
			}
			// Grab necessary settings as constants
			const isOneModificationPerDay: boolean = this.settings.oneModificationPerDay
			const updateInterval: number = this.settings.updateInterval
			
			// Makes the front matter type clearer by casting
			const frontmatter = yamlData as FrontMatterCache
			const yamlProperty: YAMLProperty = this.getPropertyFromFrontMatter('last-modified', frontmatter)
			
			const currentMoment: Moment = moment()
			const previousMoment: Moment | null = this.getLatestMomentFromProperty(yamlProperty)
			
			// set to Infinity to start with. Will change if the current and previous moment can be found.
			// at that point, a difference can be made and should be greater than 0 but less than Infinity.
			let secondsSinceLastUpdate: number = Infinity

			// Setting one modification per day to true should always bypass the update interval that's set.
			// This is achieved by keeping the seconds since last update set to Infinity,
			// so that the comparison with the update interval always returns true.
			if (!isOneModificationPerDay) {
				if (previousMoment?.isValid()) {
					secondsSinceLastUpdate = currentMoment.diff(previousMoment, 'seconds')
				}
			}
			
			if (secondsSinceLastUpdate > updateInterval) {
				const newEntry: string = currentMoment.format('YYYY-MM-DDTHH:mm:ss')
				let newEntries: string[]
				let finalIndex: number

				if (Array.isArray(yamlProperty.value)) {
					newEntries = yamlProperty.value
					// Empty arrays could put index into negatives.
					// Prevent by taking max.
					finalIndex = Math.max((newEntries.length - 1), 0)
				}
				else {
					newEntries = []
					finalIndex = 0
				}

				// Must ignore one modification per day if there are no entries (previousMoment is null).
				if (isOneModificationPerDay && previousMoment?.isValid()) {
					if (currentMoment.isSame(previousMoment, 'day')) {
						// Change the entry for the same day rather than pushing a new one
						// to match the expected behaviour of 'one modification per day'.
						newEntries[finalIndex] = newEntry
					}
					else {
						newEntries.push(newEntry)
					}
				}
				else {
					newEntries.push(newEntry)
				}
			
				frontmatter['last-modified'] = newEntries
			}
		})
	}
	
	/** 
	 * Compares the file parameter to the list of ignored folders, returning a boolean value.
	 * @param {TFile} file File to compare with the ignored folders list.
	 * @returns {boolean} Returns a boolean to say whether the file exists within the ignored folders.
	 */
	private fileWithinIgnoredFolders(file: TFile): boolean {
		return this.settings.ignoredFolders.some((folder: string) => 
			file.path.startsWith(folder + '/'))
	}

	/**
	 * @param property the 'key' of the frontmatter.
	 * @param fm the frontmatter object to get the property value from.
	 * @returns Returns the YAML Property with the property name and value as one object.
	 * Returns a YAML entry with both elements undefined if the array is undefined or empty.
	 */
	private getPropertyFromFrontMatter(property: string, fm: FrontMatterCache): YAMLProperty {
		return {
			property: property,
			value: fm[property]
		}
	}

	/**
	 * Attempts to return the latest moment from the YAML property given whether that's single value or the last value in an array.
	 * @param yamlProperty YAML property to pull the value from.
	 * @returns Returns most recent moment from the yamlProperty or null if none is found.
	 */
	private getLatestMomentFromProperty(yamlProperty: YAMLProperty) {
		const value: string | string[] | undefined = yamlProperty.value
		let prevMoment: Moment | null = null
		
		// Check for the different types that 'value' could be.
		if (Array.isArray(value)) {
			const momentString: string = value[value.length - 1]
			prevMoment = moment(momentString, 'YYYY-MM-DDTHH:mm:ss', true)
		}
		else if (String.isString(value)) {
			prevMoment = moment(value, 'YYYY-MM-DDTHH:mm:ss', true)
		}
		
		return prevMoment
	}
}

