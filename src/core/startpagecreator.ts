import { ID_STAT_TOTAL_NOTES, ID_STAT_TODAY_EDITED, ID_STAT_TOTAL_SIZE } from "@/types";
import { App, TFile, Menu, Keymap, WorkspaceLeaf, moment } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import { VIEW_TYPE_START_PAGE } from "@/views/startpageview";
import FooterTextUtil from "@/utils/footertextutil";
import SvgUtil from "@/utils/svgutil";
import { MyUtil } from "@/utils/myutil";
import { NewNoteUtil } from "@/utils/newnoteutil";
import { VersionChecker } from "@/utils/versionchecker";
import SearchModal from "@/views/searchmodal";
import CaptureModal from "@/views/capturemodal";
import PinnedNotesModal from "@/views/pinnednotesmodal";
import TodayEditedModal from "@/views/todayeditedmodal";
import { DailyNoteUtil } from "@/utils/dailynoteutil";

declare module "obsidian" {
	interface App {
		setting: {
			open(): void;
			openTabById(id: string): void;
		};
	}
}

export default class StartPageCreator {
	private app: App;
	private plugin: StartPagePlugin;
	private container: Element;
	private searchBox: HTMLInputElement;
	private keyHandler: (e: KeyboardEvent) => void;
	private arrowHandler: ((e: KeyboardEvent) => void) | null = null;
	private initialQuery: string = "";
	private stats = [
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
		private tabFolderItems: { folderPath: string; folderName: string; files: TFile[] }[] | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private draggingPinnedPath: string | null = null;
	private resizeHandler: (() => void) | null = null;
	private activeTabIndex = 0;

		constructor(app: App, plugin: StartPagePlugin, container: Element) {
		this.app = app;
		this.plugin = plugin;
		this.container = container;
	}

		public async createStartPage(
			pinnedNotes: TFile[] | null, 
			recentNotes: TFile[] | null,
			tabFolderItems?: { folderPath: string; folderName: string; files: TFile[] }[] | null
		): Promise<void> {
			this.initData(pinnedNotes, recentNotes, tabFolderItems || null);

		this.container.empty();
		this.container.addClass("start-page-container");

		const header = this.createHeader();
		const mainContent = this.createMainContent();
		const footer = await this.createFooter();

		this.container.appendChild(header);
		this.container.appendChild(mainContent);
		this.container.appendChild(footer);

		const newNoteBtn = this.createNewNoteButton();
		this.container.appendChild(newNoteBtn);

		const captureBtn = this.createDailyCaptureButton();
		if (captureBtn) {
			this.container.appendChild(captureBtn);
		}

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

		private initData(
			pinnedNotes: TFile[] | null, 
			recentNotes: TFile[] | null,
			tabFolderItems: { folderPath: string; folderName: string; files: TFile[] }[] | null = null
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

	public async updateNoteModifiedTimes(notes: TFile[]) {
		for (const note of notes) {
			const noteElement = this.container.querySelector(`[data-note-path="${note.path}"] .note-date`);
			if (noteElement) {
				const formattedDate = MyUtil.formatDate(note.stat.mtime);
				noteElement.textContent = formattedDate;
			}
		}
	}

	private createHeader(): HTMLElement {
		const header = this.createElement("header", "header");

		const logo = this.createElement("div", "logo");
		const logoIcon = SvgUtil.createLogoIcon();
		// 问候语替代默认标题占位，不额外占用一行
		const logoText = this.plugin.settings.showGreeting
			? this.createElement("span", "logo-text greeting", this.getGreetingText())
			: this.createElement("span", "logo-text", "Start Page for Obsidian");

		this.searchBox = this.createElement("input", "search-box", "") as HTMLInputElement;
		this.searchBox.type = "text";
		this.searchBox.placeholder = t("search_placeholder");
		this.searchBox.addEventListener("click", () => {
			this.showSearchModal();
		});

		this.searchBox.addEventListener("focus", (e) => {
			(e.target as HTMLInputElement).blur();
		});
		// 假搜索框必须移出 Tab 序：其 focus 即自 blur 的监听会把 Tab 焦点弹飞，表现为"按 Tab 没反应"
		this.searchBox.setAttribute("tabindex", "-1");

		const searchBoxContainer = this.createElement("div", "search-box-container");
		searchBoxContainer.appendChild(this.searchBox);

		logo.appendChild(logoIcon);
		logo.appendChild(logoText);
		logo.appendChild(searchBoxContainer);

		const headerActions = this.createElement("div", "header-actions");

			const manageBtn = this.createElement("button", "manage-btn");
			manageBtn.setAttribute("title", t("manage"));
			manageBtn.appendChild(SvgUtil.createSettingsIcon());
			manageBtn.addEventListener("click", () => {
				const setting = this.app.setting;
				setting.open();

				window.setTimeout(() => {
					setting.openTabById(this.plugin.manifest.id);
				}, 100);
			});
			headerActions.appendChild(manageBtn);

			if (this.hasUpdate()) {
			const updateBadge = this.createUpdateBadge();
			headerActions.appendChild(updateBadge);
		}

		header.appendChild(logo);
		header.appendChild(headerActions);

		return header;
	}

	private createStatsSection(): HTMLElement {
		const statsSection = this.createElement("div", "stats-section");

		this.stats.forEach((stat) => {
			// 卡片按语义路由：总笔记开搜索、今日编辑下钻列表、总大小纯信息不可点
			const hasAction = stat.id !== ID_STAT_TOTAL_SIZE;
			const statCard = this.createElement("div", `stat-card${hasAction ? "" : " static"}`);
			const statIcon = this.createElement("div", "stat-icon");
			const svg = SvgUtil.createStatIcon(stat.id);
			statIcon.appendChild(svg!);

			const statContent = this.createElement("div", "stat-content");
			const statNumber = this.createElement("div", "stat-number", stat.data.number.toString());
			const statLabel = this.createElement("div", "stat-label", stat.data.label());

			statContent.appendChild(statNumber);
			statContent.appendChild(statLabel);
			statCard.appendChild(statIcon);
			statCard.appendChild(statContent);
			statsSection.appendChild(statCard);

			if (stat.id === ID_STAT_TODAY_EDITED) {
				statCard.addEventListener("click", () => {
					new TodayEditedModal(this.app, this.plugin).open();
				});
			} else if (stat.id === ID_STAT_TOTAL_NOTES) {
				statCard.addEventListener("click", () => {
					this.showSearchModal();
				});
			}
		});

		return statsSection;
	}

	private createNoteItem(note: TFile | null, isPinned: boolean = false): HTMLElement | null {
		if (!note) {
			return null;
		}

		const styleSettings = isPinned ? this.plugin.settings.pinnedNotesStyle : this.plugin.settings.recentNotesStyle;

		const noteItem = this.createElement("div", `note-item${isPinned ? " pinned" : ""}`);
		noteItem.setAttribute("data-note-path", note.path);

		// 列表键盘可达：条目可 Tab 聚焦，Enter/空格与点击同语义；
		// 空格是单字符键，会冒泡进主页"任意字符开搜索"监听，必须阻断
		noteItem.setAttribute("role", "button");
		noteItem.setAttribute("tabindex", "0");
		noteItem.addEventListener("keydown", (event: KeyboardEvent) => {
			if (event.key !== "Enter" && event.key !== " ") {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			noteItem.click();
		});

		if (styleSettings.itemPadding) noteItem.style.padding = styleSettings.itemPadding;
		if (styleSettings.itemMargin) noteItem.style.margin = styleSettings.itemMargin;

		noteItem.addEventListener("click", async (event: MouseEvent) => {
				const modResult = Keymap.isModEvent(event);

				const newLeaf = modResult || (this.plugin.settings.openNotesInNewTab ? "tab" : false);

				if (newLeaf) {
					this.app.workspace.openLinkText(note.path, "", newLeaf);
				} else {
					const existingLeaf = this.findOpenLeaf(note.path);

					if (existingLeaf) {
						await this.app.workspace.revealLeaf(existingLeaf);
					} else {
						this.app.workspace.openLinkText(note.path, "", false);
					}
				}
			});

			noteItem.addEventListener("mousedown", (event: MouseEvent) => {
				if (event.button === 1) {
					event.preventDefault();
					event.stopPropagation();
				}
			});

			noteItem.addEventListener("mouseup", (event: MouseEvent) => {
				if (event.button === 1) {
					event.preventDefault();
					event.stopPropagation();
					this.app.workspace.openLinkText(note.path, "", "tab");
				}
			});

		noteItem.addEventListener("mouseenter", (event) => {
			this.app.workspace.trigger("hover-link", {
				event: event,
				source: VIEW_TYPE_START_PAGE,
				hoverParent: noteItem,
				targetEl: noteItem,
				linktext: note.path,
				sourcePath: "",
			});
		});

		if (isPinned) {
			// HTML5 拖拽排序：拖放目标即插入位置，drop 后写回数组顺序
			noteItem.draggable = true;
			noteItem.addEventListener("dragstart", () => {
				this.draggingPinnedPath = note.path;
				noteItem.addClass("dragging");
			});
			noteItem.addEventListener("dragend", () => {
				this.draggingPinnedPath = null;
				noteItem.removeClass("dragging");
			});
			noteItem.addEventListener("dragover", (e) => e.preventDefault());
			noteItem.addEventListener("drop", (e) => {
				e.preventDefault();
				// 阻断冒泡，避免落点在条目上时又触发列表末尾追加
				e.stopPropagation();
				if (this.draggingPinnedPath && this.draggingPinnedPath !== note.path) {
					this.reorderPinnedNote(this.draggingPinnedPath, note.path);
				}
				this.draggingPinnedPath = null;
			});

			noteItem.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				event.stopPropagation();

				const menu = new Menu();
				menu.addItem((item) => {
					item.setTitle(t("remove_from_pinned_notes"))
						.setIcon("pin-off")
						.onClick(() => {
							void this.togglePinnedNote(note, false);
						});
				});

				menu.showAtMouseEvent(event);
			});
		} else {
			// 最近/文件夹列表右键快捷置顶，提升添加置顶的可发现性
			noteItem.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				event.stopPropagation();

				const menu = new Menu();
				menu.addItem((item) => {
					item.setTitle(t("add_to_pinned_notes"))
						.setIcon("pin")
						.onClick(() => {
							void this.togglePinnedNote(note, true);
						});
				});

				menu.showAtMouseEvent(event);
			});
		}

		const noteIcon = this.createElement("div", "note-icon");
		const fileType = note.extension;
		const iconSvg = SvgUtil.createFileIcon(fileType);
		noteIcon.appendChild(iconSvg);

		const noteContent = this.createElement("div", "note-content");
		const noteTitle = this.createElement("div", "note-title", note.basename);
		
		if (styleSettings.noteTitleFontSize) noteTitle.style.fontSize = styleSettings.noteTitleFontSize;
		if (styleSettings.noteTitleMargin) noteTitle.style.margin = styleSettings.noteTitleMargin;
		if (styleSettings.noteTitlePadding) noteTitle.style.padding = styleSettings.noteTitlePadding;

		const noteMeta = this.createElement("div", "note-meta", "");

		const noteDate = MyUtil.formatDate(note.stat.mtime);
		let folderPath = note.parent ? note.parent.path : "/";
		if (!folderPath.startsWith("/")) {
			folderPath = "/" + folderPath;
		}
		const noteDateEl = this.createElement("div", "note-date", noteDate);
		if (styleSettings.noteDateFontSize) noteDateEl.style.fontSize = styleSettings.noteDateFontSize;
		
		noteMeta.appendChild(noteDateEl);

		const noteExtEl = this.createElement("div", "note-ext", "." + note.extension);
		noteMeta.appendChild(noteExtEl);

		const folderIcon = SvgUtil.createFolderIcon();
		noteMeta.appendChild(folderIcon);
		
		const noteFolderEl = this.createElement("div", "note-folder", MyUtil.truncateMiddle(folderPath));
		if (styleSettings.noteFolderFontSize) noteFolderEl.style.fontSize = styleSettings.noteFolderFontSize;

		noteMeta.appendChild(noteFolderEl);

		noteTitle.setAttribute("title", note.basename);
		noteContent.appendChild(noteTitle);
		noteContent.appendChild(noteMeta);

		// 悬停动作区：置顶非高频操作，与低频动作统一收进 ⋯ 菜单，条目保持简洁
		const noteActions = this.createElement("div", "note-actions");

		const moreBtn = this.createElement("button", "btn-icon");
		moreBtn.setAttribute("title", t("more_actions"));
		moreBtn.setAttribute("aria-label", t("more_actions"));
		moreBtn.appendChild(SvgUtil.createMoreIcon());
		moreBtn.addEventListener("click", (event) => {
			// 阻断冒泡，避免按钮点击触发整条目的打开
			event.stopPropagation();

			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle(isPinned ? t("remove_from_pinned_notes") : t("add_to_pinned_notes"))
					.setIcon(isPinned ? "pin-off" : "pin")
					.onClick(() => {
						void this.togglePinnedNote(note, !isPinned);
					});
			});
			menu.addSeparator();
			menu.addItem((item) => {
				item.setTitle(t("open_in_new_tab"))
					.setIcon("external-link")
					.onClick(() => {
						this.app.workspace.openLinkText(note.path, "", "tab");
					});
			});
			menu.addItem((item) => {
				item.setTitle(t("reveal_in_file_explorer"))
					.setIcon("folder-open")
					.onClick(() => {
						// revealInFolder 是 file-explorer 视图的内部方法，移动端无此 leaf 时静默跳过
						const explorer = this.app.workspace.getLeavesOfType("file-explorer")[0]?.view as unknown as { revealInFolder?: (file: TFile) => void };
						explorer?.revealInFolder?.(note);
					});
			});

			menu.showAtMouseEvent(event);
		});
		noteActions.appendChild(moreBtn);

		noteItem.appendChild(noteIcon);
		noteItem.appendChild(noteContent);
		noteItem.appendChild(noteActions);

		return noteItem;
	}

	private createNotesSection(title: string, notes: TFile[] | null, isPinned: boolean = false, icon: SVGSVGElement): HTMLElement {
		const styleSettings = isPinned ? this.plugin.settings.pinnedNotesStyle : this.plugin.settings.recentNotesStyle;

		const section = this.createElement("section", "section");
		if (styleSettings.sectionMargin) section.style.margin = styleSettings.sectionMargin;
		if (styleSettings.sectionPadding) section.style.padding = styleSettings.sectionPadding;

		const sectionHeader = this.createElement("div", "section-header");
		if (styleSettings.headerMargin) sectionHeader.style.margin = styleSettings.headerMargin;
		if (styleSettings.headerPadding) sectionHeader.style.padding = styleSettings.headerPadding;

			const sectionTitle = this.createElement("h2", "section-title");
			sectionTitle.appendChild(icon);
			sectionTitle.appendChild(document.createTextNode(title));
			if (isPinned && notes) {
				const countBadge = this.createElement("span", "note-count-badge", `${notes.length}`);
				sectionTitle.appendChild(countBadge);
			}
			if (styleSettings.titleFontSize) sectionTitle.style.fontSize = styleSettings.titleFontSize;
			if (styleSettings.titleMargin) sectionTitle.style.margin = styleSettings.titleMargin;
			if (styleSettings.titlePadding) sectionTitle.style.padding = styleSettings.titlePadding;

			if (isPinned) {
				sectionHeader.appendChild(sectionTitle);
			} else {
			const dropdownDiv = this.createRecentNotesLimitDropdown();
			sectionHeader.appendChild(sectionTitle);
			sectionHeader.appendChild(dropdownDiv);
		}

		const notesList = this.createElement("div", "notes-list");
		if (styleSettings.listGap) notesList.style.gap = styleSettings.listGap;

		if (isPinned && notes && notes.length > 0) {
			// 列表空白区域也是合法落点：支持拖到末尾；条目自身的 drop 会阻断冒泡
			notesList.addEventListener("dragover", (e) => e.preventDefault());
			notesList.addEventListener("drop", (e) => {
				e.preventDefault();
				if (this.draggingPinnedPath) {
					this.movePinnedNoteToEnd(this.draggingPinnedPath);
					this.draggingPinnedPath = null;
				}
			});
		}

		if (notes && notes.length > 0) {
			if (isPinned) {
				notes.forEach((note) => {
					const noteItem = this.createNoteItem(note, isPinned);
					if (noteItem) {
						notesList.appendChild(noteItem);
					}
				});
			} else {
				this.appendGroupedRecentNotes(notesList, notes);
			}
		} else if (isPinned) {
			notesList.appendChild(this.createPinnedEmptyState());
		} else {
			notesList.appendChild(this.createEmptyState(t("recent_empty_hint")));
		}

		section.appendChild(sectionHeader);
		section.appendChild(notesList);

		return section;
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

	private appendGroupedRecentNotes(notesList: HTMLElement, notes: TFile[]): void {
		// 分段边界与相对时间的 24h/7d 规则对齐；标题插入同一列表容器，保持单一滚动区
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

		const groups: { title: string; notes: TFile[] }[] = [
			{ title: t("recent_group_today"), notes: [] },
			{ title: t("recent_group_this_week"), notes: [] },
			{ title: t("recent_group_earlier"), notes: [] },
		];
		for (const note of notes) {
			if (note.stat.mtime >= todayStart.getTime()) {
				groups[0].notes.push(note);
			} else if (note.stat.mtime >= weekAgo) {
				groups[1].notes.push(note);
			} else {
				groups[2].notes.push(note);
			}
		}

		for (const group of groups) {
			if (group.notes.length === 0) {
				continue;
			}
			notesList.appendChild(this.createElement("div", "notes-group-title", group.title));
			for (const note of group.notes) {
				const noteItem = this.createNoteItem(note, false);
				if (noteItem) {
					notesList.appendChild(noteItem);
				}
			}
		}
	}

	private createPinnedEmptyState(): HTMLElement {
		// 空状态附带动线入口：文案里的右键添加路径不可发现，按钮直达置顶管理弹窗
		const empty = this.createEmptyState(t("pinned_empty_hint"));
		const addBtn = this.createElement("button", "notes-list-empty-action", t("pinned_empty_add"));
		addBtn.addEventListener("click", () => {
			new PinnedNotesModal(this.app, this.plugin, () => MyUtil.refreshStartPage(this.app)).open();
		});
		empty.appendChild(addBtn);
		return empty;
	}

	private createEmptyState(text: string): HTMLElement {
		return this.createElement("div", "notes-list-empty", text);
	}

		private createContentGrid(): HTMLElement {
			const contentGrid = this.createElement("div", "content-grid");

			// 板块显隐开关：置顶与文件夹标签共用标签容器
			const showTabs = this.plugin.settings.showTabs;
			const showRecent = this.plugin.settings.showRecentSection;
			if (showTabs) {
				const tabContainer = this.createTabContainer();
				tabContainer.classList.add("pinned-notes");
				contentGrid.appendChild(tabContainer);
			}

			if (showRecent) {
				const recentSection = this.createNotesSection(t("recent_notes"), this.recentNotes, false, SvgUtil.createRecentNoteIcon());
				recentSection.classList.add("recent-notes");
				contentGrid.appendChild(recentSection);
			}

			// 只剩一个板块时占满整行，避免栅格留下半栏空白
			if (showTabs !== showRecent) {
				contentGrid.addClass("single-section");
			}

			return contentGrid;
		}

		private createTabContainer(): HTMLElement {
			const tabs = this.buildTabItems();
			// 文件夹 tab 可能在重渲染间被移除，序号收敛到现存范围
			const activeIndex = Math.min(this.activeTabIndex, tabs.length - 1);
			this.activeTabIndex = activeIndex;
			const container = this.createElement("div", "tab-container");

			// Tab bar
			const bar = this.createElement("div", "tab-bar");

			const scrollLeft = this.createElement("button", "tab-scroll-btn");
			scrollLeft.appendChild(SvgUtil.createChevronLeftIcon());
			bar.appendChild(scrollLeft);

			const tabList = this.createElement("div", "tab-list");
			tabs.forEach((tab, i) => {
				const tabItem = this.createElement("div", `tab-item${i === activeIndex ? " active" : ""}`);
				tabItem.dataset.tabIndex = i.toString();

				const label = this.createElement("span", "tab-item-label", tab.label);
				tabItem.appendChild(label);

				if (tab.closable) {
					const closeBtn = this.createElement("button", "tab-close-btn");
					closeBtn.appendChild(SvgUtil.createCloseIcon());
					closeBtn.addEventListener("click", (e) => {
						e.stopPropagation();
						if (tab.folderPath) {
							this.plugin.settings.tabFolderPaths =
								this.plugin.settings.tabFolderPaths.filter((p) => p !== tab.folderPath);
							this.plugin.saveSettings();
							MyUtil.refreshStartPage(this.app);
						}
					});
					tabItem.appendChild(closeBtn);
				}

				tabItem.addEventListener("click", () => {
					this.switchTab(i);
				});

				tabList.appendChild(tabItem);
			});
			bar.appendChild(tabList);

			const scrollRight = this.createElement("button", "tab-scroll-btn");
			scrollRight.appendChild(SvgUtil.createChevronRightIcon());
			bar.appendChild(scrollRight);

			container.appendChild(bar);

			// Content panels
			const contentWrapper = this.createElement("div", "tab-content-wrapper");
			tabs.forEach((tab, i) => {
				const panel = this.createElement("div", `tab-panel${i === activeIndex ? " active" : ""}`);
				panel.dataset.tabIndex = i.toString();
				if (tab.id === "pinned") {
					// Pinned notes tab — reuse createNotesSection with isPinned=true for the "Manage" button
					const section = this.createNotesSection(t("pinned_notes"), this.pinnedNotes, true, SvgUtil.createPinnedNoteIcon());
					panel.appendChild(section);
				} else {
					// Folder tab — use folder-specific panel
					const section = this.createFolderTabPanel(tab.label, tab.notes);
					panel.appendChild(section);
				}
				contentWrapper.appendChild(panel);
			});
			container.appendChild(contentWrapper);

			// Set up scroll button visibility
			const updateButtons = () => {
				this.updateScrollButtons(tabList, scrollLeft, scrollRight);
			};

			// 单例 observer，每次渲染仅重挂回调并重定向观察目标，避免重建泄漏
			if (!this.resizeObserver) {
				this.resizeObserver = new ResizeObserver(() => this.resizeHandler?.());
			}
			this.resizeObserver.disconnect();
			this.resizeHandler = updateButtons;
			this.resizeObserver.observe(tabList);

			tabList.addEventListener("scroll", updateButtons);
			scrollLeft.addEventListener("click", () => {
				tabList.scrollBy({ left: -150, behavior: "smooth" });
			});
			scrollRight.addEventListener("click", () => {
				tabList.scrollBy({ left: 150, behavior: "smooth" });
			});

			return container;
		}

		private buildTabItems(): { id: string; label: string; notes: TFile[]; closable: boolean; folderPath?: string }[] {
			const tabs: { id: string; label: string; notes: TFile[]; closable: boolean; folderPath?: string }[] = [];

			{
				tabs.push({
					id: "pinned",
					label: t("tab_pinned"),
					notes: this.pinnedNotes || [],
					closable: false,
				});
			}

			if (this.tabFolderItems) {
				for (const item of this.tabFolderItems) {
					tabs.push({
						id: `folder-${item.folderPath}`,
						label: item.folderName,
						notes: item.files,
						closable: true,
						folderPath: item.folderPath,
					});
				}
			}

			return tabs;
		}

		private createFolderTabPanel(title: string, notes: TFile[]): HTMLElement {
			const styleSettings = this.plugin.settings.pinnedNotesStyle;

			const section = this.createElement("section", "section");
			if (styleSettings.sectionMargin) section.style.margin = styleSettings.sectionMargin;
			if (styleSettings.sectionPadding) section.style.padding = styleSettings.sectionPadding;

			const sectionHeader = this.createElement("div", "section-header");
			if (styleSettings.headerMargin) sectionHeader.style.margin = styleSettings.headerMargin;
			if (styleSettings.headerPadding) sectionHeader.style.padding = styleSettings.headerPadding;

			const sectionTitle = this.createElement("h2", "section-title");
				const folderIcon = SvgUtil.createFolderIcon();
				sectionTitle.appendChild(folderIcon);
				sectionTitle.appendChild(document.createTextNode(title));
				if (notes) {
					const countBadge = this.createElement("span", "note-count-badge", `${notes.length}`);
					sectionTitle.appendChild(countBadge);
				}

			sectionHeader.appendChild(sectionTitle);

			const notesList = this.createElement("div", "notes-list");
			if (styleSettings.listGap) notesList.style.gap = styleSettings.listGap;

			if (notes && notes.length > 0) {
				for (const note of notes) {
					const noteItem = this.createNoteItem(note, false);
					if (noteItem) {
						notesList.appendChild(noteItem);
					}
				}
			} else {
				notesList.appendChild(this.createEmptyState(t("folder_tab_empty_hint")));
			}

			section.appendChild(sectionHeader);
			section.appendChild(notesList);

			return section;
		}

		private switchTab(index: number) {
			// 记录激活序号，供 vault 事件触发整页重渲染后恢复
			this.activeTabIndex = index;

			const tabContainer = this.container.querySelector(".tab-container");
			if (!tabContainer) return;

			tabContainer.querySelectorAll(".tab-item").forEach((el, i) => {
				el.classList.toggle("active", i === index);
			});

			tabContainer.querySelectorAll(".tab-panel").forEach((el, i) => {
				el.classList.toggle("active", i === index);
			});
		}

		private updateScrollButtons(tabList: HTMLElement, scrollLeft: HTMLElement, scrollRight: HTMLElement) {
			const hasOverflow = tabList.scrollWidth > tabList.clientWidth + 2;
			scrollLeft.classList.toggle("hidden", !hasOverflow || tabList.scrollLeft <= 1);
			scrollRight.classList.toggle("hidden", !hasOverflow || tabList.scrollLeft >= tabList.scrollWidth - tabList.clientWidth - 2);
		}

		private getGreetingText(): string {
		// 时间段问候 + 本地化长日期，随 moment.locale() 走界面语言
		// Obsidian 对 moment 的类型声明是命名空间，需与 newnoteutil 相同的转换
		const createMoment = moment as unknown as () => { format(format?: string): string; hour(): number };
		const now = createMoment();
		const hour = now.hour();
		const key = hour < 5 ? "greeting_night" : hour < 12 ? "greeting_morning" : hour < 18 ? "greeting_afternoon" : "greeting_evening";
		const dateStr = `${now.format("LL")} ${now.format("dddd")}`;
		return `${t(key)} · ${dateStr}`;
	}

		private createMainContent(): HTMLElement {
		const mainContent = this.createElement("main", "main-content");

		if (this.plugin.settings.showStatBar) {
			const statsSection = this.createStatsSection();
			mainContent.appendChild(statsSection);
		}

		const contentGrid = this.createContentGrid();
		mainContent.appendChild(contentGrid);

		return mainContent;
	}

	private async createFooter(): Promise<HTMLElement> {
		const footer = this.createElement("footer", "footer");

		const love = this.createElement("p", "", t("default_footer_text"));
		footer.appendChild(love);

		this.updateFooterTextAsync(love);

		// 快捷键原本完全不可发现，页脚提示用于提升可发现性
		if (this.plugin.settings.showShortcutHints) {
			footer.appendChild(this.createElement("div", "footer-shortcut-hints", t("footer_shortcut_hints")));
		}

		return footer;
	}

	private async updateFooterTextAsync(footerElement: HTMLElement): Promise<void> {
		try {
			const footerText = await FooterTextUtil.getFooterText(this.plugin);
			footerElement.textContent = footerText;

			if (this.plugin.settings.showCustomFooterText && this.plugin.settings.useRandomFooterText) {
				if (!footerElement.querySelector("#refresh-footer-text")) {
					const refreshSvg = SvgUtil.createRefreshIcon();
					refreshSvg.setAttribute("id", "refresh-footer-text");
					refreshSvg.addEventListener("click", () => {
						this.plugin.settings.todayRandomEnFooterText = "";
						this.plugin.settings.todayRandomZhFooterText = "";
						this.plugin.saveSettings();
						footerElement.textContent = t("loading_footer_text");
						this.updateFooterTextAsync(footerElement);
					});
					footerElement.appendChild(refreshSvg);
				}
			}
		} catch (error) {
			console.error("Failed to load footer text:", error);
		}
	}

	private createDailyCaptureButton(): HTMLElement | null {
		// 未启用核心 Daily notes 插件时隐藏速记入口
		if (!this.plugin.settings.showDailyCapture || !DailyNoteUtil.getTarget(this.app)) {
			return null;
		}
		const btn = this.createElement("button", "start-page-capture-btn");
		btn.setAttribute("title", t("capture_title"));
		btn.setAttribute("aria-label", t("capture_title"));
		btn.appendChild(SvgUtil.createCaptureIcon());
		btn.addEventListener("click", () => new CaptureModal(this.app, this.plugin).open());
		return btn;
	}

	private createNewNoteButton(): HTMLElement {
		const btn = this.createElement("button", "start-page-new-note-btn");
		btn.setAttribute("title", t("new_note"));
		btn.setAttribute("aria-label", t("new_note"));

		const icon = SvgUtil.createNewNoteIcon();
		btn.appendChild(icon);

		btn.addEventListener("click", async () => {
			await this.createNewNote();
		});

		return btn;
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

	private createElement(tag: string, className: string = "", textContent: string = ""): HTMLElement {
		const element = document.createElement(tag);
		if (className) element.className = className;
		if (textContent) element.textContent = textContent;
		return element;
	}

	private createRecentNotesLimitDropdown(): HTMLDivElement {
		const dropdown = document.createElement("select");

		for (let i = 5; i <= 50; i += 5) {
			const option = document.createElement("option");
			option.value = i.toString();
			option.textContent = i.toString();
			dropdown.appendChild(option);

			if (i === this.plugin.settings.recentNotesLimit) {
				option.selected = true;
			}
		}

		dropdown.addEventListener("change", () => {
			const limit = parseInt(dropdown.value, 10);
			this.plugin.settings.recentNotesLimit = limit;
			this.plugin.saveSettings();
			MyUtil.refreshStartPage(this.app);
		});

		const label = document.createElement("label");
		label.className = "recent-notes-limit-label";
		label.textContent = t("show_count");
		label.htmlFor = dropdown.id;

		const container = document.createElement("div");
		container.appendChild(label);
		container.appendChild(dropdown);

		return container;
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

			if (document.querySelector('.modal-container')) {
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
				(item: TFile) => {
					const newLeaf = this.plugin.settings.openNotesInNewTab ? "tab" : false;
					this.app.workspace.openLinkText(item.path, "", newLeaf);
				},
				this.initialQuery
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

	private hasUpdate(): boolean {
		// 关闭检查更新时即使残留了 latestVersion 也不展示徽标
		if (!this.plugin.settings.checkForUpdates) {
			return false;
		}
		const latestVersion = this.plugin.settings.latestVersion;
		if (!latestVersion) {
			return false;
		}
		return VersionChecker.hasUpdate(this.plugin.manifest.version, latestVersion);
	}

	private createUpdateBadge(): HTMLElement {
		const badge = this.createElement("div", "update-badge");
		badge.setAttribute("title", t("new_version_available"));

		const badgeIcon = this.createElement("span", "update-badge-icon", "🎉");
		const badgeText = this.createElement("span", "update-badge-text", 
			t("update_to_version").replace("{version}", this.plugin.settings.latestVersion));

		badge.appendChild(badgeIcon);
		badge.appendChild(badgeText);

		badge.addEventListener("click", () => {
			const setting = this.app.setting;
			setting.open();

			window.setTimeout(() => {
				setting.openTabById("community-plugins");
			}, 100);
		});

		return badge;
	}
}
