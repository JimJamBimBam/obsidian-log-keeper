import { Plugin, TFile, Editor, moment, FrontMatterCache, MarkdownView, getFrontMatterInfo } from 'obsidian'
import { LogKeeperTab, DEFAULT_SETTINGS, LogKeeperSettings } from './settings'
import { Moment } from 'moment'

interface YAMLProperty {
	property: string | undefined,
	value: unknown
}

interface FileState {
	lastMeaningfulSignature?: string
	pendingSignature?: string
	timer?: ReturnType<typeof setTimeout>
}

const LAST_MODIFIED_PROPERTY = 'last-modified'
const TIMESTAMP_FORMAT = 'YYYY-MM-DDTHH:mm:ss'
const DEBOUNCE_UPDATE_MS = 5_000

/**
 * @author James Sonneveld
 * @link https://github.com/JimJamBimBam
 */
export default class LogKeeperPlugin extends Plugin {
	settings: LogKeeperSettings
	private fileStates: Map<string, FileState> = new Map()

	async onload() {
		await this.loadSettings()

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new LogKeeperTab(this.app, this))

		// editor-change can fire for programmatic changes as well as user edits.
		// To avoid feedback loops, we only react when a normalized content signature
		// (content excluding the tracked frontmatter property) has changed.
		this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
			if (!(info instanceof MarkdownView) || !info.file) {
				return
			}
			void this.handleEditorContentChange(info.file, editor)
		}))

		// editor-change does not reliably fire on paste. We listen to
		// editor-paste separately to cover clipboard actions. The paste event
		// fires *before* the pasted content is inserted into the editor, so we
		// defer the signature check to the next tick via setTimeout.
		this.registerEvent(this.app.workspace.on('editor-paste', (evt, editor, info) => {
			if (evt.defaultPrevented) {
				return
			}
			if (!(info instanceof MarkdownView) || !info.file) {
				return
			}
			const file = info.file
			setTimeout(() => void this.handleEditorContentChange(file, editor), 0)
		}))

		this.registerEvent(this.app.workspace.on('file-open', (file) => {
			if (!(file instanceof TFile) || file.extension !== 'md') {
				return
			}
			void this.ensurePersistedSignatureSeeded(file)
		}))
	}

	onunload() {
		for (const state of this.fileStates.values()) {
			if (state.timer) {
				clearTimeout(state.timer)
			}
		}
		this.fileStates.clear()
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	private getFileState(filePath: string): FileState {
		let state = this.fileStates.get(filePath)
		if (!state) {
			state = {}
			this.fileStates.set(filePath, state)
		}
		return state
	}

	private async ensurePersistedSignatureSeeded(file: TFile): Promise<string | null> {
		const state = this.getFileState(file.path)
		if (state.lastMeaningfulSignature !== undefined) {
			return state.lastMeaningfulSignature
		}

		try {
			const signature = this.getContentSignature(await this.app.vault.cachedRead(file))
			if (state.lastMeaningfulSignature === undefined) {
				state.lastMeaningfulSignature = signature
			}
			return state.lastMeaningfulSignature ?? signature
		}
		catch {
			return null
		}
	}

	private async handleEditorContentChange(file: TFile, editor: Editor): Promise<void> {
		if (this.fileWithinIgnoredFolders(file)) {
			return
		}

		const state = this.getFileState(file.path)
		const currentSignature = this.getContentSignature(editor.getValue())
		let previousSignature: string | null | undefined = state.lastMeaningfulSignature

		if (previousSignature === undefined) {
			previousSignature = await this.ensurePersistedSignatureSeeded(file)
		}

		if (previousSignature === currentSignature) {
			state.lastMeaningfulSignature = currentSignature
			return
		}

		state.lastMeaningfulSignature = currentSignature
		this.scheduleFrontmatterUpdate(file, currentSignature)
	}

	private scheduleFrontmatterUpdate(file: TFile, scheduledSignature: string): void {
		const state = this.getFileState(file.path)
		if (state.timer) {
			clearTimeout(state.timer)
		}

		state.pendingSignature = scheduledSignature

		state.timer = setTimeout(() => {
			state.timer = undefined
			void this.flushScheduledFrontmatterUpdate(file, scheduledSignature)
		}, DEBOUNCE_UPDATE_MS)
	}

	private async flushScheduledFrontmatterUpdate(file: TFile, scheduledSignature: string): Promise<void> {
		const state = this.fileStates.get(file.path)
		if (!state) {
			return
		}

		if (this.fileWithinIgnoredFolders(file)) {
			state.pendingSignature = undefined
			return
		}

		if (state.pendingSignature !== scheduledSignature) {
			// Stale timer.
			return
		}

		if (state.lastMeaningfulSignature !== scheduledSignature) {
			// Content changed again after this timer was scheduled.
			return
		}

		const currentSignature = await this.getCurrentFileSignature(file)
		if (currentSignature === null) {
			state.pendingSignature = undefined
			return
		}

		if (currentSignature !== scheduledSignature) {
			// The latest editor content changed since scheduling (e.g. more typing).
			state.lastMeaningfulSignature = currentSignature
			this.scheduleFrontmatterUpdate(file, currentSignature)
			return
		}

		await this.updateFrontmatter(file)

		// Keep the signature as-is. A plugin self-write only touches the tracked
		// frontmatter property, so normalized content signature should not change.
		state.pendingSignature = undefined
	}

	private async getCurrentFileSignature(file: TFile): Promise<string | null> {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view
			if (view instanceof MarkdownView && view.file?.path === file.path) {
				return this.getContentSignature(view.editor.getValue())
			}
		}

		try {
			const content = await this.app.vault.cachedRead(file)
			return this.getContentSignature(content)
		}
		catch {
			return null
		}
	}

	private getContentSignature(content: string): string {
		const normalizedContent = this.removeLastModifiedFromFrontmatter(content)
		return this.hashString(normalizedContent)
	}

	private removeLastModifiedFromFrontmatter(content: string): string {
		const frontMatterInfo = getFrontMatterInfo(content)

		if (!frontMatterInfo.exists) {
			return content
		}

		const frontmatterLines = frontMatterInfo.frontmatter.split(/\r?\n/)
		const bodyContent = content.substring(frontMatterInfo.contentStart)
		const filteredFrontmatter = this.removeTrackedPropertyFromFrontmatterLines(frontmatterLines)

		if (filteredFrontmatter.length === 0) {
			return bodyContent
		}

		return `---\n${filteredFrontmatter.join('\n')}\n---\n${bodyContent}`
	}

	private removeTrackedPropertyFromFrontmatterLines(lines: string[]): string[] {
		const filtered: string[] = []
		const keyPattern = /^(?:['"]?last-modified['"]?):.*$/

		for (let index = 0; index < lines.length; index++) {
			const line = lines[index]
			const keyMatch = line.match(keyPattern)
			if (!keyMatch) {
				filtered.push(line)
				continue
			}

			// Skip continuation lines (list items in Obsidian format)
			while (index + 1 < lines.length) {
				const nextLine = lines[index + 1]
				if (nextLine.trim().length === 0) {
					index++
					continue
				}
				const nextIndent = nextLine.match(/[\x20]{2}-[\x20]{1}.*/)?.[0].length ?? 0
				if (nextIndent > 0) {
					index++
					continue
				}
				break
			}
		}

		return filtered
	}

	private hashString(input: string): string {
		let hash = 5381
		for (let index = 0; index < input.length; index++) {
			hash = ((hash << 5) + hash) + input.charCodeAt(index)
			hash |= 0
		}
		return `sig-${(hash >>> 0).toString(16)}`
	}

	/**
	* Will attempt to update the 'last-modified' property of the frontmatter of the given file.
	* @author James Sonneveld https://github.com/JimJamBimBam
	* @param {TFile} file - The file that is having its frontmatter updated.
	* @returns {Promise<void>} Nothing
	*/
	async updateFrontmatter(file: TFile): Promise<void> {
		if (this.fileWithinIgnoredFolders(file)) {
			return
		}

		await this.app.fileManager.processFrontMatter(file, (yamlData) => {
			const frontmatter = yamlData as FrontMatterCache
			const yamlProperty: YAMLProperty = this.getPropertyFromFrontMatter(LAST_MODIFIED_PROPERTY, frontmatter)

			const isOneModificationPerDay = this.settings.oneModificationPerDay
			const updateInterval = this.settings.updateInterval

			const existingEntries = this.getNormalizedTimestampEntries(yamlProperty.value)
			const previousMoment = this.getLatestMomentFromEntries(existingEntries)
			const currentMoment = moment()
			const newEntry = currentMoment.format(TIMESTAMP_FORMAT)

			let shouldWrite = false
			const nextEntries = [...existingEntries]

			if (isOneModificationPerDay) {
				shouldWrite = true

				if (previousMoment?.isValid() && currentMoment.isSame(previousMoment, 'day')) {
					nextEntries[nextEntries.length - 1] = newEntry
				}
				else {
					nextEntries.push(newEntry)
				}
			}
			else {
				let secondsSinceLastUpdate = Infinity
				if (previousMoment?.isValid()) {
					secondsSinceLastUpdate = currentMoment.diff(previousMoment, 'seconds')
				}

				if (secondsSinceLastUpdate > updateInterval) {
					shouldWrite = true
					nextEntries.push(newEntry)
				}
			}

			if (shouldWrite) {
				frontmatter[LAST_MODIFIED_PROPERTY] = this.getNormalizedTimestampEntries(nextEntries)
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
	 */
	private getPropertyFromFrontMatter(property: string, fm: FrontMatterCache): YAMLProperty {
		return {
			property: property,
			value: fm[property]
		}
	}

	/**
	 * Return a sorted and normalized array of timestamps from frontmatter.
	 * Invalid entries are ignored.
	 */
	private getNormalizedTimestampEntries(value: unknown): string[] {
		const parsedMoments: Moment[] = []
		const values = Array.isArray(value) ? value : [value]

		for (const entry of values) {
			if (typeof entry !== 'string') {
				continue
			}

			const parsed = moment(entry, TIMESTAMP_FORMAT, true)
			if (parsed.isValid()) {
				parsedMoments.push(parsed)
			}
		}

		return parsedMoments
			.sort((left, right) => left.valueOf() - right.valueOf())
			.map((timestamp) => timestamp.format(TIMESTAMP_FORMAT))
	}

	/**
	 * Attempts to return the latest moment in an array of timestamps.
	 * @param entries An ordered list of timestamp strings.
	 * @returns Returns most recent moment from entries or null if none is found.
	 */
	private getLatestMomentFromEntries(entries: string[]): Moment | null {
		if (entries.length === 0) {
			return null
		}

		const latestEntry = entries[entries.length - 1]
		const parsed = moment(latestEntry, TIMESTAMP_FORMAT, true)
		return parsed.isValid() ? parsed : null
	}
}
