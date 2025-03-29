import { Editor, Notice, Plugin, TFile, moment, CachedMetadata } from 'obsidian'
import { ModifiedFileListTab, DEFAULT_SETTINGS, ModifiedFileListSettings } from 'src/settings'
import { Moment } from 'moment'
import { MetadataPrintModal } from 'src/MetadataPrintModal'

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
	Will attempt to update the 'last-modified' property of the frontmatter of the given file.
	@author James Sonneveld <https://github.com/JimJamBimBam>
	@param {TFile} file - The file that is having it's frontmatter updated.
	@returns {Promise<void>} Nothing
	*/
	async updateFrontmatter(file: TFile): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (this.settings.ignoredFolders.some(folder => file.path.startsWith(folder + '/'))) {
				// The folder the file is in is part of the exclusion list.
				return
			}
			
			// moment() will return the current time to use later.
			const currentMoment: Moment = moment()
			const isOneModificationPerDay: boolean = this.settings.oneModificationPerDay
			const updateInterval: number = this.settings.updateInterval
			
			// previous moment will be undefined unless one can be found in the frontmatter.
			let previousMoment: Moment | undefined
			// set to Infinity to start with. Will change if the current and previous moment can be found.
			// at that point, a difference can be made and should be greater than 0 but less than Infinity.
			let secondsSinceLastUpdate: number = Infinity

			// Grabbing all previous entries to be able to calculations on time differences.
			// When a file/note has no property, final index and previous entry will be undefined.
			let previousEntries: Array<any> | undefined = frontmatter['last-modified']
			let finalIndex: number | undefined = (typeof previousEntries === 'undefined' || previousEntries.length == 0) ? undefined : previousEntries.length - 1
			let previousEntry: any | undefined = previousEntries?.[Number(finalIndex)] ?? undefined

			previousMoment = typeof previousEntry === 'undefined' ? undefined : moment(previousEntry, 'YYYY-MM-DDTHH:mm:ss')

			// Leave 'secondSinceLastUpdate' as Infinity if we want one modification per day
			// as we always want to call the code that updates the frontmatter as if there is no delay.
			if (!isOneModificationPerDay) {
				if (previousMoment?.isValid()) {
					secondsSinceLastUpdate = currentMoment.diff(previousMoment, 'seconds')
				}
			}
			
			// The new entry is created here when the seconds since last modification is greater than the update interval.
			if (secondsSinceLastUpdate > updateInterval) {
				let newEntry: string = currentMoment.format('yyyy-MM-DDTHH:mm:ss')
				let newEntries: Array<string> = previousEntries ?? []
				
				// Must ignore one modification per day if there are no entries.
				if (isOneModificationPerDay && newEntries.length > 0) {
					// Instead of pushing new entry to the end of the array,
					// the most recent value on the same day should be updated to this time stamp
					// if it exists that is.
					if (typeof(finalIndex) !== 'undefined' && typeof(previousMoment) !== 'undefined') {					
						// Moments on the same day, change entry to the most recent one,
						// otherwise, push a new entry onto the array.
						if (currentMoment.isSame(previousMoment, 'day'))
							newEntries[finalIndex] = newEntry
						else {
							newEntries.push(newEntry)
						}
					}
				}
				else {
					newEntries.push(newEntry)
				}
			
				// Update the modified date field
				frontmatter['last-modified'] = newEntries
			}
		})
	}
}

