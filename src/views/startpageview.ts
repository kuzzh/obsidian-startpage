import { App, ItemView, TFile, Menu, EventRef, Platform, debounce } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import StartPageCreator from "@/core/startpagecreator";

export const VIEW_TYPE_START_PAGE = "start-page-view";

export class StartPageView extends ItemView {
	plugin: StartPagePlugin;
	private fileChangeEventRef: EventRef;
	private fileCreateEventRef: EventRef;
	private fileDeleteEventRef: EventRef;
	private fileRenameEventRef: EventRef;
	private refreshTimer: number | null = null;
	private readonly REFRESH_INTERVAL = 60000; // Refresh every 1 minute
	private startPageCreator: StartPageCreator;
	private isScrollEventRegistered = false;

	constructor(leaf: any, app: App, plugin: StartPagePlugin) {
		super(leaf);
		this.app = app;
		this.plugin = plugin;

		this.navigation = true;
		this.icon = "home";
		this.contentEl.addClass("start-page-view");

		if (this.plugin.settings.showTitleNavigationBar === "show") {
			this.showTitleNavigationBar(true);
		} else if (this.plugin.settings.showTitleNavigationBar === "hide") {
			this.showTitleNavigationBar(false);
		} else {
			// default
			if (Platform.isDesktop) {
				this.showTitleNavigationBar(false);
			} else {
				this.showTitleNavigationBar(true);
			}
		}
	}

	getViewType(): string {
		return VIEW_TYPE_START_PAGE;
	}

	getDisplayText(): string {
		return t("start_page");
	}

	getIcon(): string {
		return "home";
	}

	canClose(): boolean {
		return true;
	}

	async onOpen() {
		await this.renderContent();

		this.restoreScrollPosition();

		// Register file change events
		this.fileChangeEventRef = this.app.vault.on("modify", () => {
			this.renderContent();
		});

		// Add event listeners for file creation, deletion, and rename
		this.fileCreateEventRef = this.app.vault.on("create", () => {
			this.renderContent();
		});

		this.fileDeleteEventRef = this.app.vault.on("delete", () => {
			this.renderContent();
		});

		this.fileRenameEventRef = this.app.vault.on("rename", () => {
			this.renderContent();
		});

		this.registerDomEvent(this.containerEl, "contextmenu", (evt: MouseEvent) => {
			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle(t("refresh"))
					.setIcon("refresh-cw")
					.onClick(() => this.renderContent());
			});
			menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
		});
	}

	async onClose() {
		// Clean up event listeners and timer when view is closed
		if (this.fileChangeEventRef) {
			this.app.vault.offref(this.fileChangeEventRef);
		}
		if (this.fileCreateEventRef) {
			this.app.vault.offref(this.fileCreateEventRef);
		}
		if (this.fileDeleteEventRef) {
			this.app.vault.offref(this.fileDeleteEventRef);
		}
		if (this.fileRenameEventRef) {
			this.app.vault.offref(this.fileRenameEventRef);
		}
		this.clearRefreshTimer();
	}

	private clearRefreshTimer() {
		if (this.refreshTimer !== null) {
			window.clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	private startRefreshTimerIfNeeded(pinnedNotes: TFile[], recentNotes: TFile[]) {
		this.clearRefreshTimer();

		// Check if there are any files that need to be refreshed every 24 hours
		const needsRefresh = pinnedNotes.concat(recentNotes).some((file) => {
			const diff = Date.now() - file.stat.mtime;
			return diff < 24 * 60 * 60 * 1000; // Files modified within 24 hours need periodic refresh
		});

		if (needsRefresh) {
			this.refreshTimer = window.setInterval(() => {
				this.updateModifiedTimes();
			}, this.REFRESH_INTERVAL);
		}
	}

	private async updateModifiedTimes() {
		if (!this.startPageCreator) {
			return;
		}

		const pinnedNotes = this.getTFiles(this.plugin.settings.pinnedNotes);
		const recentNotes = this.getRecentNotes(this.plugin.settings.recentNotesLimit);

		const notesToUpdate = pinnedNotes.concat(recentNotes).filter((file) => {
			const diff = Date.now() - file.stat.mtime;
			return diff < 24 * 60 * 60 * 1000;
		});

		if (notesToUpdate.length > 0) {
			await this.startPageCreator.updateNoteModifiedTimes(notesToUpdate);
		}
	}

	public async renderContent() {
		const container = this.containerEl.children[1] as HTMLElement;

		if (!this.isScrollEventRegistered) {
			this.registerDomEvent(container, "scroll", () => {
				debounce(() => {
					this.saveScrollPosition();
				}, 300);
			});

			this.isScrollEventRegistered = true;
		}

		if (!this.startPageCreator) {
			this.startPageCreator = new StartPageCreator(this.app, this.plugin, container);
		}
		const pinnedNotes = this.getTFiles(this.plugin.settings.pinnedNotes);
		const recentNotes = this.getRecentNotes(this.plugin.settings.recentNotesLimit);
		await this.startPageCreator.createStartPage(pinnedNotes, recentNotes);

		this.startRefreshTimerIfNeeded(pinnedNotes, recentNotes);
	}

	private saveScrollPosition() {
		const container = document.querySelector(".start-page-container") as HTMLElement;
		if (container) {
			this.plugin.settings.scrollPosition = container.scrollTop;
			this.plugin.saveSettings();
		}
	}

	private restoreScrollPosition() {
		const container = document.querySelector(".start-page-container") as HTMLElement;
		if (container && this.plugin.settings.scrollPosition > 0) {
			// Use a small delay to ensure the content is fully rendered
			setTimeout(() => {
				container.scrollTop = this.plugin.settings.scrollPosition;
			}, 0);
		}
	}

	getTFiles(notePaths: string[] | null): TFile[] {
		if (!notePaths) {
			return [];
		}

		const tFiles = notePaths
			.map((notePath) => {
				const file = this.app.vault.getAbstractFileByPath(notePath);
				if (file instanceof TFile) {
					return file;
				}
				return null;
			})
			.filter((file): file is TFile => file !== null);

		return tFiles;
	}

	getRecentNotes(limit: number): TFile[] {
		const recentlyOpenedPaths = this.app.workspace.getLastOpenFiles();

		const allFiles = this.plugin.settings.includeAllFilesInRecent ? this.app.vault.getFiles() : this.app.vault.getMarkdownFiles();

		if (allFiles.length === 0) {
			return [];
		}

		// Calculate the most recent time for each file (the maximum of modification time or access time)
		const filesWithTime = allFiles.map((file) => {
			let lastAccessTime = 0;

			// Calculate access time based on position in the list of recently opened files
			const openIndex = recentlyOpenedPaths.indexOf(file.path);
			if (openIndex !== -1) {
				// Convert the index to a timestamp, the earlier the file, the newer the time
				// Use the current time minus the index minutes to simulate the access time
				lastAccessTime = Date.now() - openIndex * 60 * 1000;
			}

			// Take the maximum value of modification time and access time
			const lastTime = Math.max(file.stat.mtime, lastAccessTime);

			return { file, lastTime };
		});

		// Sort by most recent time and return a specified number of files
		return filesWithTime
			.sort((a, b) => b.lastTime - a.lastTime)
			.slice(0, limit)
			.map((item) => item.file);
	}

	showTitleNavigationBar(show: boolean) {
		const viewHeader = this.containerEl.querySelector('.workspace-leaf-content[data-type="start-page-view"] .view-header');
		if (viewHeader) {
			(viewHeader as HTMLElement).style.display = show ? "" : "none";
		}
	}
}
