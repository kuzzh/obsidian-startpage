import { App, Keymap, TFile, WorkspaceLeaf } from "obsidian";
import { ID_STAT_TOTAL_NOTES, ID_STAT_TODAY_EDITED, ID_STAT_TOTAL_SIZE } from "@/types";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import { MyUtil } from "@/utils/myutil";
import { NewNoteUtil } from "@/utils/newnoteutil";
import SearchModal from "@/views/searchmodal";
import CaptureModal from "@/views/capturemodal";
import PinnedNotesModal from "@/views/pinnednotesmodal";
import TodayEditedModal from "@/views/todayeditedmodal";
import CompactSkin from "./skins/compactskin";
import ClassicSkin from "./skins/classicskin";
import { bindNoteItem } from "./skins/shared";
import {
	NoteBindingOptions,
	StartPageActions,
	StartPageContext,
	StartPageSkin,
	StatItem,
	TabFolderItem,
} from "./skins/types";

export default class StartPageCreator {
	private app: App;
	private plugin: StartPagePlugin;
	private container: Element;
	private keyHandler: (e: KeyboardEvent) => void;
	private arrowHandler: ((e: KeyboardEvent) => void) | null = null;
	private initialQuery: string = "";
	private stats: StatItem[] = [
		{
			id: ID_STAT_TOTAL_NOTES,
			data: {
				number: 0,
				label: function () {
					return t("total_notes");
				},
			},
		},
		{
			id: ID_STAT_TODAY_EDITED,
			data: {
				number: 0,
				label: function () {
					return t("today_edited");
				},
			},
		},
		{
			id: ID_STAT_TOTAL_SIZE,
			data: {
				number: "0",
				label: function () {
					return t("total_size");
				},
			},
		},
	];
	private pinnedNotes: TFile[] | null = null;
	private recentNotes: TFile[] | null = null;
	private tabFolderItems: TabFolderItem[] | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private resizeHandler: (() => void) | null = null;
	private activeTabIndex = 0;
	private draggingPinnedPath: string | null = null;
	private skin: StartPageSkin | null = null;

	constructor(app: App, plugin: StartPagePlugin, container: Element) {
		this.app = app;
		this.plugin = plugin;
		this.container = container;
	}

	public async createStartPage(
		pinnedNotes: TFile[] | null,
		recentNotes: TFile[] | null,
		tabFolderItems?: TabFolderItem[] | null,
	): Promise<void> {
		this.initData(pinnedNotes, recentNotes, tabFolderItems || null);

		this.container.empty();
		this.container.addClass("start-page-container");
		// 容器跨重渲染复用，切换风格时必须清掉旧变体类，否则两套规则同时生效
		this.container.removeClass("sp-style-compact");
		this.container.removeClass("sp-style-classic");
		this.container.addClass(`sp-style-${this.plugin.settings.uiStyle}`);

		this.skin = this.plugin.settings.uiStyle === "classic" ? new ClassicSkin() : new CompactSkin();
		await this.skin.render(this.createContext());

		this.setupKeyListener();

		(this.container as HTMLElement).tabIndex = -1;
	}

	public focusContainer(): void {
		(this.container as HTMLElement).focus();
	}

	public destroy(): void {
		this.removeKeyListener();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.resizeHandler = null;
	}

	public async updateNoteModifiedTimes(notes: TFile[]) {
		for (const note of notes) {
			const noteElement = this.container.querySelector(`[data-note-path="${note.path}"] .note-date`);
			if (noteElement) {
				const formattedDate = MyUtil.formatDate(note.stat.mtime);
				noteElement.textContent = formattedDate;
			}
		}
	}

	private initData(
		pinnedNotes: TFile[] | null,
		recentNotes: TFile[] | null,
		tabFolderItems: TabFolderItem[] | null = null,
	): void {
		this.pinnedNotes = pinnedNotes;
		this.recentNotes = recentNotes;
		this.tabFolderItems = tabFolderItems;

		this.stats.forEach((stat) => {
			if (stat.id === ID_STAT_TOTAL_NOTES) {
				stat.data.number = this.app.vault.getMarkdownFiles().length;
			} else if (stat.id === ID_STAT_TODAY_EDITED) {
				stat.data.number = this.getTodayModifiedNoteCount();
			} else if (stat.id === ID_STAT_TOTAL_SIZE) {
				stat.data.number = MyUtil.formatSize(this.getTotalSize());
			}
		});
	}

	private createContext(): StartPageContext {
		const actions: StartPageActions = {
			openNote: (note, options) => this.openNote(note, options),
			togglePin: (note, pin) => {
				void this.togglePinnedNote(note, pin);
			},
			reorderPin: (srcPath, targetPath) => this.reorderPinnedNote(srcPath, targetPath),
			movePinToEnd: (srcPath) => this.movePinnedNoteToEnd(srcPath),
			showSearch: () => this.showSearchModal(),
			openSettings: () => this.openPluginSettings(),
			openCommunityPlugins: () => this.openCommunityPlugins(),
			openTodayEdited: () => new TodayEditedModal(this.app, this.plugin).open(),
			openPinnedManager: () => new PinnedNotesModal(this.app, this.plugin, () => MyUtil.refreshStartPage(this.app)).open(),
			setRecentLimit: (limit) => {
				this.plugin.settings.recentNotesLimit = limit;
				void this.plugin.saveSettings();
				MyUtil.refreshStartPage(this.app);
			},
			createNewNote: () => {
				void this.createNewNote();
			},
			openCapture: () => new CaptureModal(this.app, this.plugin).open(),
			openDailyNote: () => this.app.commands.executeCommandById("daily-notes"),
			revealInExplorer: (note) => this.revealInExplorer(note),
		};

		const ctx: StartPageContext = {
			app: this.app,
			plugin: this.plugin,
			settings: this.plugin.settings,
			container: this.container as HTMLElement,
			stats: this.stats,
			pinnedNotes: this.pinnedNotes,
			recentNotes: this.recentNotes,
			tabFolderItems: this.tabFolderItems,
			activeTabIndex: this.activeTabIndex,
			actions,
			bindNoteItem: (el: HTMLElement, note: TFile, options: NoteBindingOptions) => {
				bindNoteItem(ctx, el, note, options);
			},
			setActiveTab: (index) => {
				this.activeTabIndex = index;
			},
			observeTabList: (tabList, update) => this.observeTabList(tabList, update),
			setDraggingPinnedPath: (path) => {
				this.draggingPinnedPath = path;
			},
			getDraggingPinnedPath: () => this.draggingPinnedPath,
		};

		return ctx;
	}

	private openNote(note: TFile, options: { newTab?: boolean; event?: MouseEvent } = {}): void {
		const modEvent = options.event ? Keymap.isModEvent(options.event) : false;
		const newLeaf = options.newTab ? "tab" : modEvent || (this.plugin.settings.openNotesInNewTab ? "tab" : false);

		if (newLeaf) {
			this.app.workspace.openLinkText(note.path, "", newLeaf);
			return;
		}

		const existingLeaf = this.findOpenLeaf(note.path);
		if (existingLeaf) {
			void this.app.workspace.revealLeaf(existingLeaf);
		} else {
			this.app.workspace.openLinkText(note.path, "", false);
		}
	}

	private async togglePinnedNote(note: TFile, pin: boolean): Promise<void> {
		const list = this.plugin.settings.pinnedNotes;
		if (pin) {
			if (list.includes(note.path)) {
				return;
			}
			list.push(note.path);
		} else {
			this.plugin.settings.pinnedNotes = list.filter((path) => path !== note.path);
		}
		await this.plugin.saveSettings();
		MyUtil.refreshStartPage(this.app);
	}

	private movePinnedNoteToEnd(srcPath: string): void {
		const list = this.plugin.settings.pinnedNotes;
		const from = list.indexOf(srcPath);
		// 已在末尾时无需重排，避免无意义重渲染
		if (from === -1 || from === list.length - 1) {
			return;
		}
		list.splice(from, 1);
		list.push(srcPath);
		void this.plugin.saveSettings();
		MyUtil.refreshStartPage(this.app);
	}

	private reorderPinnedNote(srcPath: string, targetPath: string): void {
		const list = this.plugin.settings.pinnedNotes;
		const from = list.indexOf(srcPath);
		const to = list.indexOf(targetPath);
		if (from === -1 || to === -1) {
			return;
		}
		list.splice(from, 1);
		list.splice(to, 0, srcPath);
		void this.plugin.saveSettings();
		MyUtil.refreshStartPage(this.app);
	}

	private observeTabList(tabList: HTMLElement, update: () => void): void {
		// 单例 observer，每次渲染仅重挂回调并重定向观察目标，避免重建泄漏
		if (!this.resizeObserver) {
			this.resizeObserver = new ResizeObserver(() => this.resizeHandler?.());
		}
		this.resizeObserver.disconnect();
		this.resizeHandler = update;
		this.resizeObserver.observe(tabList);
	}

	private openPluginSettings(): void {
		const setting = this.app.setting;
		setting.open();

		window.setTimeout(() => {
			setting.openTabById(this.plugin.manifest.id);
		}, 100);
	}

	private openCommunityPlugins(): void {
		const setting = this.app.setting;
		setting.open();

		window.setTimeout(() => {
			setting.openTabById("community-plugins");
		}, 100);
	}

	private revealInExplorer(note: TFile): void {
		// revealInFolder 是 file-explorer 视图的内部方法，移动端无此 leaf 时静默跳过
		const explorer = this.app.workspace.getLeavesOfType("file-explorer")[0]?.view as unknown as { revealInFolder?: (file: TFile) => void };
		explorer?.revealInFolder?.(note);
	}

	private async createNewNote(): Promise<void> {
		try {
			const newFile = await NewNoteUtil.createNote(this.app, this.plugin);
			if (!newFile) {
				return;
			}

			const existingLeaf = this.findOpenLeaf(newFile.path);
			if (existingLeaf) {
				await this.app.workspace.revealLeaf(existingLeaf);
				return;
			}

			const leaf = this.app.workspace.getLeaf("tab");
			await leaf.openFile(newFile);
		} catch (error) {
			console.error("Failed to create new note:", error);
		}
	}

	private findOpenLeaf(filePath: string): WorkspaceLeaf | null {
		const leaf = this.app.workspace.getLeavesOfType("markdown").find((candidate) => {
			const state = candidate.view.getState();
			return state["file"] === filePath;
		});

		return leaf || null;
	}

	getTodayModifiedNoteCount(): number {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const markdownFiles: TFile[] = this.app.vault.getMarkdownFiles();

		const count = markdownFiles.filter((file) => {
			const modifiedTime = file.stat.mtime;
			return modifiedTime >= today.getTime();
		}).length;

		return count;
	}

	getTotalSize(): number {
		const allFiles: TFile[] = this.plugin.settings.includeAllFilesInRecent ? this.app.vault.getFiles() : this.app.vault.getMarkdownFiles();

		let totalSize = 0;

		allFiles.forEach((file) => {
			totalSize += file.stat.size;
		});

		return totalSize;
	}

	private setupKeyListener(): void {
		this.keyHandler = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
				return;
			}

			if (e.key.length !== 1) {
				return;
			}

			const target = e.target as Node;
			if (
				target.instanceOf(HTMLInputElement) ||
				target.instanceOf(HTMLTextAreaElement) ||
				target.instanceOf(HTMLSelectElement) ||
				(target.instanceOf(HTMLElement) && target.isContentEditable)
			) {
				return;
			}

			if (document.querySelector(".modal-container")) {
				return;
			}

			this.initialQuery = e.key;
			this.showSearchModal();
			e.preventDefault();
			e.stopPropagation();
		};

		(this.container as HTMLElement).addEventListener("keydown", this.keyHandler);

		// ↑/↓ 在可见条目间移动焦点，避免 Tab 穿越每个条目后的 ⋯ 按钮链
		this.arrowHandler = (e: KeyboardEvent) => {
			if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
				return;
			}

			const target = e.target as Node;
			if (
				target.instanceOf(HTMLInputElement) ||
				target.instanceOf(HTMLTextAreaElement) ||
				target.instanceOf(HTMLSelectElement) ||
				(target.instanceOf(HTMLElement) && target.isContentEditable)
			) {
				return;
			}

			if (document.querySelector(".modal-container")) {
				return;
			}

			const items = this.getVisibleNoteItems();
			if (items.length === 0) {
				return;
			}

			const current = items.indexOf(document.activeElement as HTMLElement);
			const next = current === -1
				? (e.key === "ArrowDown" ? 0 : items.length - 1)
				: e.key === "ArrowDown"
					? Math.min(current + 1, items.length - 1)
					: Math.max(current - 1, 0);
			items[next].focus();
			e.preventDefault();
		};
		(this.container as HTMLElement).addEventListener("keydown", this.arrowHandler);
	}

	private getVisibleNoteItems(): HTMLElement[] {
		// 隐藏面板（display:none 的 tab panel）内条目 offsetParent 为 null，需排除
		return Array.from(this.container.querySelectorAll<HTMLElement>(".note-item")).filter((el) => el.offsetParent !== null);
	}

	private showSearchModal(): void {
		const modal = new SearchModal(
			this.app,
			this.plugin,
			(item: TFile, forceTab: boolean) => {
				const newLeaf = forceTab || this.plugin.settings.openNotesInNewTab ? "tab" : false;
				this.app.workspace.openLinkText(item.path, "", newLeaf);
			},
			this.initialQuery,
		);
		modal.open();
		this.initialQuery = "";
	}

	private removeKeyListener(): void {
		if (this.keyHandler) {
			(this.container as HTMLElement).removeEventListener("keydown", this.keyHandler);
		}
		if (this.arrowHandler) {
			(this.container as HTMLElement).removeEventListener("keydown", this.arrowHandler);
			this.arrowHandler = null;
		}
	}
}
