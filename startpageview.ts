import { App, ItemView, TFile, Menu, EventRef } from "obsidian";
import StartPagePlugin from "./main";
import { t } from "./i18n";
import StartPageCreator from "./startpagecreator";

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

	constructor(leaf: any, app: App, plugin: StartPagePlugin) {
		super(leaf);
		this.app = app;
		this.plugin = plugin;
		
		this.navigation = true;
		this.icon = "home";
		this.contentEl.addClass("start-page-view");
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
		// Clear existing timer
		this.clearRefreshTimer();

		// Check if there are any files that need to be refreshed every 24 hours
		const needsRefresh = pinnedNotes.concat(recentNotes).some((file) => {
			const diff = Date.now() - file.stat.mtime;
			return diff < 24 * 60 * 60 * 1000; // Files modified within 24 hours need periodic refresh
		});

		if (needsRefresh) {
			this.refreshTimer = window.setInterval(() => {
				this.renderContent();
			}, this.REFRESH_INTERVAL);
		}
	}

	public async renderContent() {
		const container = this.containerEl.children[1];

		if (!this.startPageCreator) {
			this.startPageCreator = new StartPageCreator(this.app, this.plugin, container);
		}
		const pinnedNotes = this.getTFiles(this.plugin.settings.pinnedNotes);
		const recentNotes = this.getRecentNotes(this.plugin.settings.recentNotesLimit);
		this.startPageCreator.createStartPage(pinnedNotes, recentNotes);

		this.startRefreshTimerIfNeeded(pinnedNotes, recentNotes);
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
		const files = this.app.vault.getMarkdownFiles();
		return files.sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, limit);
	}
}
