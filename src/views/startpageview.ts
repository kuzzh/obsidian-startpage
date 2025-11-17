import { App, ItemView, TFile, Menu, EventRef } from "obsidian";
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
		// 获取最近打开的文件路径
		// Get the path of the most recently opened file
		const recentlyOpenedPaths = this.app.workspace.getLastOpenFiles();

		// 获取所有markdown文件
		// Get all files
		const allFiles = this.plugin.settings.includeAllFilesInRecent ? this.app.vault.getFiles() : this.app.vault.getMarkdownFiles();

		// 为每个文件计算最近时间（修改时间或访问时间的最大值）
		// Calculate the most recent time for each file (the maximum of modification time or access time)
		const filesWithTime = allFiles.map(file => {
			let lastAccessTime = 0;

			// 根据最近打开文件列表中的位置计算访问时间
			// Calculate access time based on position in the list of recently opened files
			const openIndex = recentlyOpenedPaths.indexOf(file.path);
			if (openIndex !== -1) {
				// 将索引转换为时间戳，越靠前的文件时间越新
				// 使用当前时间减去索引分钟数来模拟访问时间
				// Convert the index to a timestamp, the earlier the file, the newer the time
				// Use the current time minus the index minutes to simulate the access time
				lastAccessTime = Date.now() - (openIndex * 60 * 1000);
			}

			// 取修改时间和访问时间的最大值
			// Take the maximum value of modification time and access time
			const lastTime = Math.max(file.stat.mtime, lastAccessTime);

			return { file, lastTime };
		});

		// 按最近时间排序并返回指定数量的文件
		// Sort by most recent time and return a specified number of files
		return filesWithTime
			.sort((a, b) => b.lastTime - a.lastTime)
			.slice(0, limit)
			.map(item => item.file);
	}
}
