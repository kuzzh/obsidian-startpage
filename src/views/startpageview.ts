import { App, ItemView, TFile, Menu, EventRef, Platform, debounce } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import StartPageCreator from "@/core/startpagecreator";
import { MyUtil } from "@/utils/myutil";

export const VIEW_TYPE_START_PAGE = "start-page-view";

export class StartPageView extends ItemView {
	plugin: StartPagePlugin;
	private fileChangeEventRef: EventRef;
	private fileCreateEventRef: EventRef;
	private fileDeleteEventRef: EventRef;
	private fileRenameEventRef: EventRef;
	private refreshTimer: number | null = null;
	private readonly REFRESH_INTERVAL = 60000;
	private startPageCreator: StartPageCreator;
	private isScrollEventRegistered = false;
	private debouncedSaveScrollPosition: () => void;

	constructor(leaf: any, app: App, plugin: StartPagePlugin) {
		super(leaf);
		this.app = app;
		this.plugin = plugin;

		this.navigation = true;
		this.icon = "home";
		this.contentEl.addClass("start-page-view");

		this.debouncedSaveScrollPosition = debounce(() => {
			this.saveScrollPosition();
		}, 300);

		if (this.plugin.settings.showTitleNavigationBar === "show") {
			this.showTitleNavigationBar(true);
		} else if (this.plugin.settings.showTitleNavigationBar === "hide") {
			this.showTitleNavigationBar(false);
		} else {
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

		this.startPageCreator?.focusContainer();

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view instanceof StartPageView) {
					this.startPageCreator?.focusContainer();
				}
			}),
		);

		this.fileChangeEventRef = this.app.vault.on("modify", () => {
			this.renderContent();
			if (this.app.workspace.getActiveViewOfType(StartPageView) === this) {
				this.startPageCreator?.focusContainer();
			}
		});

		this.fileCreateEventRef = this.app.vault.on("create", () => {
			this.renderContent();
			if (this.app.workspace.getActiveViewOfType(StartPageView) === this) {
				this.startPageCreator?.focusContainer();
			}
		});

		this.fileDeleteEventRef = this.app.vault.on("delete", () => {
			this.renderContent();
			if (this.app.workspace.getActiveViewOfType(StartPageView) === this) {
				this.startPageCreator?.focusContainer();
			}
		});

		this.fileRenameEventRef = this.app.vault.on("rename", () => {
			this.renderContent();
			if (this.app.workspace.getActiveViewOfType(StartPageView) === this) {
				this.startPageCreator?.focusContainer();
			}
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
		if (this.startPageCreator) {
			this.startPageCreator.destroy();
		}
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

		const needsRefresh = pinnedNotes.concat(recentNotes).some((file) => {
			const diff = Date.now() - file.stat.mtime;
			return diff < 24 * 60 * 60 * 1000;
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
				this.debouncedSaveScrollPosition();
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

		const allFiles = (this.plugin.settings.includeAllFilesInRecent ? this.app.vault.getFiles() : this.app.vault.getMarkdownFiles()).filter(
			(file) => !MyUtil.isFileExcluded(this.plugin.settings, file),
		);

		if (allFiles.length === 0) {
			return [];
		}

		const filesWithTime = allFiles.map((file) => {
			let lastAccessTime = 0;

			const openIndex = recentlyOpenedPaths.indexOf(file.path);
			if (openIndex !== -1) {
				lastAccessTime = Date.now() - openIndex * 60 * 1000;
			}

			const lastTime = Math.max(file.stat.mtime, lastAccessTime);

			return { file, lastTime };
		});

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
