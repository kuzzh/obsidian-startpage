import { Menu, Platform, TFile, TFolder, moment } from "obsidian";
import { t } from "@/i18n";
import SvgUtil from "@/utils/svgutil";
import FooterTextUtil from "@/utils/footertextutil";
import { MyUtil } from "@/utils/myutil";
import { VersionChecker } from "@/utils/versionchecker";
import {
	PinnedItem,
	StartPageContext,
	TabSpec,
	NoteBindingOptions,
} from "./types";

export interface NotesListOptions {
	isPinned: boolean;
	grouped?: boolean;
	emptyState: HTMLElement;
	firstRowExtra?: HTMLElement;
	renderNote: (item: PinnedItem) => HTMLElement | null;
}

export interface TabRenderOptions {
	renderPanel: (tab: TabSpec) => HTMLElement;
	decorateTab?: (tabItem: HTMLElement, tab: TabSpec) => void;
}

export function createElement(tag: string, className: string = "", textContent: string = ""): HTMLElement {
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (textContent) element.textContent = textContent;
	return element;
}

export function getGreetingText(): string {
	// 时间段问候 + 本地化长日期，随 moment.locale() 走界面语言
	// Obsidian 对 moment 的类型声明是命名空间，需与 newnoteutil 相同的转换
	const createMoment = moment as unknown as () => { format(format?: string): string; hour(): number };
	const now = createMoment();
	const hour = now.hour();
	const key = hour < 5 ? "greeting_night" : hour < 12 ? "greeting_morning" : hour < 18 ? "greeting_afternoon" : "greeting_evening";
	const dateStr = `${now.format("LL")} ${now.format("dddd")}`;
	return `${t(key)} · ${dateStr}`;
}

export function createSearchBox(ctx: StartPageContext): HTMLInputElement {
	const searchBox = createElement("input", "search-box") as HTMLInputElement;
	searchBox.type = "text";
	searchBox.placeholder = t("search_placeholder");
	searchBox.addEventListener("click", () => {
		ctx.actions.showSearch();
	});
	searchBox.addEventListener("focus", (e) => {
		(e.target as HTMLInputElement).blur();
	});
	// 假搜索框必须移出 Tab 序：其 focus 即自 blur 的监听会把 Tab 焦点弹飞，表现为"按 Tab 没反应"
	searchBox.setAttribute("tabindex", "-1");
	return searchBox;
}

export function createManageButton(ctx: StartPageContext): HTMLElement {
	const manageBtn = createElement("button", "manage-btn");
	manageBtn.setAttribute("title", t("manage"));
	manageBtn.setAttribute("aria-label", t("manage"));
	manageBtn.appendChild(SvgUtil.createSettingsIcon());
	manageBtn.addEventListener("click", () => {
		ctx.actions.openSettings();
	});
	return manageBtn;
}

export function hasUpdate(ctx: StartPageContext): boolean {
	// 关闭检查更新时即使残留了 latestVersion 也不展示徽标
	if (!ctx.settings.checkForUpdates) {
		return false;
	}
	const latestVersion = ctx.settings.latestVersion;
	if (!latestVersion) {
		return false;
	}
	return VersionChecker.hasUpdate(ctx.plugin.manifest.version, latestVersion);
}

export function createUpdateBadge(ctx: StartPageContext): HTMLElement {
	const badge = createElement("div", "update-badge");
	badge.setAttribute("title", t("new_version_available"));

	badge.appendChild(createElement("span", "update-badge-icon", "🎉"));
	badge.appendChild(createElement("span", "update-badge-text", t("update_to_version").replace("{version}", ctx.settings.latestVersion)));

	badge.addEventListener("click", () => {
		ctx.actions.openCommunityPlugins();
	});

	return badge;
}

export function createEmptyState(text: string): HTMLElement {
	return createElement("div", "notes-list-empty", text);
}

export function createPinnedEmptyState(ctx: StartPageContext): HTMLElement {
	// 空状态附带动线入口：文案里的右键添加路径不可发现，按钮直达置顶管理弹窗
	const empty = createEmptyState(t("pinned_empty_hint"));
	const addBtn = createElement("button", "notes-list-empty-action", t("pinned_empty_add"));
	addBtn.addEventListener("click", () => {
		ctx.actions.openPinnedManager();
	});
	empty.appendChild(addBtn);
	return empty;
}

export function createGroupTitleRow(label: string, extra?: HTMLElement): HTMLElement {
	const row = createElement("div", "notes-group-title");
	row.appendChild(createElement("span", "notes-group-label", label));
	if (extra) {
		row.appendChild(extra);
	}
	return row;
}

export function groupRecentNotes(notes: TFile[]): { title: string; notes: TFile[] }[] {
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
	return groups;
}

export function createNotesList(
	ctx: StartPageContext,
	notes: PinnedItem[] | null,
	options: NotesListOptions,
): HTMLElement {
	const styleSettings = options.isPinned ? ctx.settings.pinnedNotesStyle : ctx.settings.recentNotesStyle;

	const notesList = createElement("div", "notes-list");
	if (styleSettings.listGap) notesList.style.gap = styleSettings.listGap;

	if (options.isPinned && notes && notes.length > 0) {
		// 列表空白区域也是合法落点：支持拖到末尾；条目自身的 drop 会阻断冒泡
		notesList.addEventListener("dragover", (e) => e.preventDefault());
		notesList.addEventListener("drop", (e) => {
			e.preventDefault();
			const srcPath = ctx.getDraggingPinnedPath();
			if (srcPath) {
				ctx.actions.movePinToEnd(srcPath);
				ctx.setDraggingPinnedPath(null);
			}
		});
	}

	if (notes && notes.length > 0) {
		if (options.grouped) {
			// 分组只用于最近笔记；类型放宽后此处仍需 TFile 才能读取 mtime
			const recentFiles = notes.filter((note): note is TFile => note instanceof TFile);
			let first = true;
			for (const group of groupRecentNotes(recentFiles)) {
				if (group.notes.length === 0) {
					continue;
				}
				// 首个分组行带「最近 ·」前缀并挂上数量下拉，后续分组只显示段名
				notesList.appendChild(
					createGroupTitleRow(
						first ? `${t("recent_short")} · ${group.title}` : group.title,
						first ? options.firstRowExtra : undefined,
					),
				);
				first = false;
				for (const note of group.notes) {
					const noteItem = options.renderNote(note);
					if (noteItem) {
						notesList.appendChild(noteItem);
					}
				}
			}
		} else {
			for (const note of notes) {
				const noteItem = options.renderNote(note);
				if (noteItem) {
					notesList.appendChild(noteItem);
				}
			}
		}
	} else {
		notesList.appendChild(options.emptyState);
	}

	return notesList;
}

export function createRecentNotesLimitDropdown(ctx: StartPageContext): HTMLElement {
	const dropdown = document.createElement("select");
	dropdown.id = "recent-notes-limit-select";

	for (let i = 5; i <= 50; i += 5) {
		const option = document.createElement("option");
		option.value = i.toString();
		option.textContent = i.toString();
		dropdown.appendChild(option);

		if (i === ctx.settings.recentNotesLimit) {
			option.selected = true;
		}
	}

	dropdown.addEventListener("change", () => {
		ctx.actions.setRecentLimit(parseInt(dropdown.value, 10));
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

export function createActivityGrid(ctx: StartPageContext): HTMLElement {
	const grid = createElement("div", "activity-grid");
	grid.setAttribute("aria-label", t("activity_heatmap"));

	// GitHub 风格：列=周、行=星期；文件集合与统计区同口径
	const WEEKS = 16;
	const DAY = 24 * 60 * 60 * 1000;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const end = today.getTime();
	// 末列为本周（周日起），未来几天留空隐藏：起点 = 本周日往前推 (WEEKS-1) 周
	const start = end - ((WEEKS - 1) * 7 + today.getDay()) * DAY;

	const files = ctx.settings.includeAllFilesInRecent ? ctx.app.vault.getFiles() : ctx.app.vault.getMarkdownFiles();
	const counts = new Map<number, number>();
	for (const file of files) {
		const day = new Date(file.stat.mtime);
		day.setHours(0, 0, 0, 0);
		const ts = day.getTime();
		if (ts >= start) {
			counts.set(ts, (counts.get(ts) ?? 0) + 1);
		}
	}

	for (let i = 0; i < WEEKS * 7; i++) {
		const ts = start + i * DAY;
		const count = counts.get(ts) ?? 0;
		const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4;
		const cell = createElement("div", `activity-cell activity-l${level}`);
		if (ts > end) {
			cell.addClass("activity-future");
		} else {
			const dateStr = new Date(ts).toLocaleDateString(moment.locale(), { month: "short", day: "numeric" });
			cell.setAttribute("title", t("heatmap_tooltip").replace("{count}", count.toString()).replace("{date}", dateStr));
		}
		grid.appendChild(cell);
	}

	return grid;
}

export async function createFooter(ctx: StartPageContext): Promise<HTMLElement> {
	const footer = createElement("footer", "footer");

	const love = createElement("p", "", t("default_footer_text"));
	footer.appendChild(love);

	void updateFooterTextAsync(love, ctx);

	// 快捷键原本完全不可发现，页脚提示用于提升可发现性
	if (ctx.settings.showShortcutHints) {
		footer.appendChild(createElement("div", "footer-shortcut-hints", t("footer_shortcut_hints")));
	}

	return footer;
}

async function updateFooterTextAsync(footerElement: HTMLElement, ctx: StartPageContext): Promise<void> {
	try {
		const footerText = await FooterTextUtil.getFooterText(ctx.plugin);
		footerElement.textContent = footerText;

		if (ctx.settings.showCustomFooterText && ctx.settings.useRandomFooterText) {
			if (!footerElement.querySelector("#refresh-footer-text")) {
				const refreshSvg = SvgUtil.createRefreshIcon();
				refreshSvg.setAttribute("id", "refresh-footer-text");
				refreshSvg.addEventListener("click", () => {
					ctx.settings.todayRandomEnFooterText = "";
					ctx.settings.todayRandomZhFooterText = "";
					void ctx.plugin.saveSettings();
					footerElement.textContent = t("loading_footer_text");
					void updateFooterTextAsync(footerElement, ctx);
				});
				footerElement.appendChild(refreshSvg);
			}
		}
	} catch (error) {
		console.error("Failed to load footer text:", error);
	}
}

export function createTabContainer(
	ctx: StartPageContext,
	tabs: TabSpec[],
	options: TabRenderOptions,
): HTMLElement {
	// 文件夹 tab 可能在重渲染间被移除，序号收敛到现存范围
	const activeIndex = Math.min(ctx.activeTabIndex, tabs.length - 1);
	ctx.setActiveTab(activeIndex);
	const container = createElement("div", "tab-container");

	const bar = createElement("div", "tab-bar");

	const scrollLeft = createElement("button", "tab-scroll-btn");
	scrollLeft.appendChild(SvgUtil.createChevronLeftIcon());
	bar.appendChild(scrollLeft);

	const tabList = createElement("div", "tab-list");
	tabs.forEach((tab, i) => {
		const tabItem = createElement("div", `tab-item${i === activeIndex ? " active" : ""}`);
		tabItem.dataset.tabIndex = i.toString();

		tabItem.appendChild(createElement("span", "tab-item-label", tab.label));

		options.decorateTab?.(tabItem, tab);

		if (tab.closable) {
			const closeBtn = createElement("button", "tab-close-btn");
			closeBtn.appendChild(SvgUtil.createCloseIcon());
			closeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (tab.folderPath) {
					ctx.settings.tabFolderPaths = ctx.settings.tabFolderPaths.filter((p) => p !== tab.folderPath);
					void ctx.plugin.saveSettings();
					MyUtil.refreshStartPage(ctx.app);
				}
			});
			tabItem.appendChild(closeBtn);
		}

		tabItem.addEventListener("click", () => {
			ctx.setActiveTab(i);
			switchTab(container, i);
		});

		tabList.appendChild(tabItem);
	});
	bar.appendChild(tabList);

	const scrollRight = createElement("button", "tab-scroll-btn");
	scrollRight.appendChild(SvgUtil.createChevronRightIcon());
	bar.appendChild(scrollRight);

	container.appendChild(bar);

	const contentWrapper = createElement("div", "tab-content-wrapper");
	tabs.forEach((tab, i) => {
		const panel = createElement("div", `tab-panel${i === activeIndex ? " active" : ""}`);
		panel.dataset.tabIndex = i.toString();
		panel.appendChild(options.renderPanel(tab));
		contentWrapper.appendChild(panel);
	});
	container.appendChild(contentWrapper);

	const updateButtons = () => {
		updateScrollButtons(tabList, scrollLeft, scrollRight);
	};

	ctx.observeTabList(tabList, updateButtons);

	tabList.addEventListener("scroll", updateButtons);
	scrollLeft.addEventListener("click", () => {
		tabList.scrollBy({ left: -150, behavior: "smooth" });
	});
	scrollRight.addEventListener("click", () => {
		tabList.scrollBy({ left: 150, behavior: "smooth" });
	});

	return container;
}

function switchTab(container: HTMLElement, index: number): void {
	const tabContainer = container.closest(".tab-container") ?? container;
	tabContainer.querySelectorAll(".tab-item").forEach((el, i) => {
		el.classList.toggle("active", i === index);
	});
	tabContainer.querySelectorAll(".tab-panel").forEach((el, i) => {
		el.classList.toggle("active", i === index);
	});
}

function updateScrollButtons(tabList: HTMLElement, scrollLeft: HTMLElement, scrollRight: HTMLElement): void {
	const hasOverflow = tabList.scrollWidth > tabList.clientWidth + 2;
	scrollLeft.classList.toggle("hidden", !hasOverflow || tabList.scrollLeft <= 1);
	scrollRight.classList.toggle("hidden", !hasOverflow || tabList.scrollLeft >= tabList.scrollWidth - tabList.clientWidth - 2);
}

export function createContentGrid(
	ctx: StartPageContext,
	renderTabs: () => HTMLElement,
	renderRecent: () => HTMLElement,
): HTMLElement {
	const contentGrid = createElement("div", "content-grid");
	// 三种布局用修饰类切换，窄屏媒体查询仍强制单列
	contentGrid.addClass(`layout-${ctx.settings.contentLayout}`);

	// 板块显隐开关：置顶与文件夹标签共用标签容器
	const showTabs = ctx.settings.showTabs;
	const showRecent = ctx.settings.showRecentSection;
	if (showTabs) {
		const tabContainer = renderTabs();
		tabContainer.classList.add("pinned-notes");
		contentGrid.appendChild(tabContainer);
	}

	if (showRecent) {
		const recentSection = renderRecent();
		recentSection.classList.add("recent-notes");
		contentGrid.appendChild(recentSection);
	}

	// 只剩一个板块时占满整行，避免栅格留下半栏空白
	if (showTabs !== showRecent) {
		contentGrid.addClass("single-section");
	}

	return contentGrid;
}

export function bindNoteItem(
	ctx: StartPageContext,
	noteItem: HTMLElement,
	item: PinnedItem,
	options: NoteBindingOptions,
): void {
	let suppressClick = false;
	let pressTimer: number | null = null;
	let pressStart = { x: 0, y: 0 };
	let lastLongPressAt = 0;
	let lastContextMenuAt = 0;

	const clearPressTimer = () => {
		if (pressTimer !== null) {
			window.clearTimeout(pressTimer);
			pressTimer = null;
		}
	};

	const openActionsMenu = (position: { x: number; y: number }) => {
		const isFolder = item instanceof TFolder;
		const pinTitle = isFolder
			? t("remove_folder_from_pinned")
			: options.isPinned
				? t("remove_from_pinned_notes")
				: t("add_to_pinned_notes");
		const pinIcon = isFolder || options.isPinned ? "pin-off" : "pin";
		const menu = new Menu();
		menu.addItem((menuItem) => {
			menuItem.setTitle(pinTitle)
				.setIcon(pinIcon)
				.onClick(() => {
					ctx.actions.togglePin(item, isFolder ? false : !options.isPinned);
				});
		});
		menu.addSeparator();
		if (item instanceof TFile) {
			menu.addItem((menuItem) => {
				menuItem.setTitle(t("open_in_new_tab"))
					.setIcon("external-link")
					.onClick(() => {
						ctx.actions.openNote(item, { newTab: true });
					});
			});
		}
		if (!Platform.isMobile) {
			// 移动端没有文件浏览器 leaf，隐藏无效动作
			menu.addItem((menuItem) => {
				menuItem.setTitle(t("reveal_in_file_explorer"))
					.setIcon("folder-open")
					.onClick(() => {
						ctx.actions.revealInExplorer(item);
					});
			});
		}
		menu.showAtPosition(position);
	};

	// 列表键盘可达：条目可 Tab 聚焦，Enter/空格与点击同语义；
	// 空格是单字符键，会冒泡进主页"任意字符开搜索"监听，必须阻断
	noteItem.setAttribute("role", "button");
	noteItem.setAttribute("tabindex", "0");
	noteItem.addEventListener("keydown", (event: KeyboardEvent) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			event.stopPropagation();
			noteItem.click();
			return;
		}
		// 没有 ⋯ 按钮后，键盘用户仍可通过上下文菜单键/Shift+F10 打开动作菜单
		if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
			event.preventDefault();
			event.stopPropagation();
			const rect = noteItem.getBoundingClientRect();
			openActionsMenu({ x: rect.left + 24, y: rect.top + 24 });
		}
	});

	noteItem.addEventListener("click", (event: MouseEvent) => {
		// 长按已经弹出菜单，松开手指后的合成 click 不应再触发条目动作
		if (suppressClick) {
			suppressClick = false;
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (item instanceof TFolder) {
			ctx.actions.revealInExplorer(item);
			return;
		}
		ctx.actions.openNote(item, { event });
	});

	noteItem.addEventListener("contextmenu", (event) => {
		event.preventDefault();
		event.stopPropagation();
		// 移动端长按可能再补发 contextmenu，避免重复弹菜单
		if (Date.now() - lastLongPressAt < 600) {
			return;
		}
		lastContextMenuAt = Date.now();
		openActionsMenu({ x: event.clientX, y: event.clientY });
	});

	// 触屏/笔长按：移动超过阈值视为滚动，取消计时
	noteItem.addEventListener("pointerdown", (event: PointerEvent) => {
		if (event.pointerType === "mouse") {
			return;
		}
		pressStart = { x: event.clientX, y: event.clientY };
		clearPressTimer();
		pressTimer = window.setTimeout(() => {
			pressTimer = null;
			// 系统 contextmenu 若先于计时器触发，则不重复弹菜单
			if (Date.now() - lastContextMenuAt < 600) {
				return;
			}
			lastLongPressAt = Date.now();
			suppressClick = true;
			window.setTimeout(() => {
				suppressClick = false;
			}, 800);
			openActionsMenu(pressStart);
		}, 500);
	});
	noteItem.addEventListener("pointermove", (event: PointerEvent) => {
		if (pressTimer === null) {
			return;
		}
		if (Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) {
			clearPressTimer();
		}
	});
	noteItem.addEventListener("pointerup", clearPressTimer);
	noteItem.addEventListener("pointercancel", clearPressTimer);
	noteItem.addEventListener("pointerleave", clearPressTimer);

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
			if (item instanceof TFolder) {
				ctx.actions.revealInExplorer(item);
			} else {
				ctx.actions.openNote(item, { newTab: true });
			}
		}
	});

	noteItem.addEventListener("mouseenter", (event) => {
		// 文件夹没有可预览的笔记内容
		if (item instanceof TFolder) {
			return;
		}
		ctx.app.workspace.trigger("hover-link", {
			event: event,
			source: "start-page-view",
			hoverParent: noteItem,
			targetEl: noteItem,
			linktext: item.path,
			sourcePath: "",
		});
	});

	if (options.isPinned) {
		// HTML5 拖拽排序：拖放目标即插入位置，drop 后写回数组顺序
		noteItem.draggable = true;
		noteItem.addEventListener("dragstart", () => {
			ctx.setDraggingPinnedPath(item.path);
			noteItem.addClass("dragging");
		});
		noteItem.addEventListener("dragend", () => {
			ctx.setDraggingPinnedPath(null);
			noteItem.removeClass("dragging");
		});
		noteItem.addEventListener("dragover", (e) => e.preventDefault());
		noteItem.addEventListener("drop", (e) => {
			e.preventDefault();
			// 阻断冒泡，避免落点在条目上时又触发列表末尾追加
			e.stopPropagation();
			const srcPath = ctx.getDraggingPinnedPath();
			if (srcPath && srcPath !== item.path) {
				ctx.actions.reorderPin(srcPath, item.path);
			}
			ctx.setDraggingPinnedPath(null);
		});
	}
}
