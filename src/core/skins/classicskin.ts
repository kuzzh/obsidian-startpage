import { Menu, Platform, TFile } from "obsidian";
import { t } from "@/i18n";
import SvgUtil from "@/utils/svgutil";
import { MyUtil } from "@/utils/myutil";
import { DailyNoteUtil } from "@/utils/dailynoteutil";
import { ID_STAT_TODAY_EDITED, ID_STAT_TOTAL_NOTES, ID_STAT_TOTAL_SIZE } from "@/types";
import {
	createContentGrid,
	createElement,
	createEmptyState,
	createFooter,
	createManageButton,
	createNotesList,
	createPinnedEmptyState,
	createRecentNotesLimitDropdown,
	createSearchBox,
	createTabContainer,
	createUpdateBadge,
	getGreetingText,
	hasUpdate,
} from "./shared";
import { StartPageContext, StartPageSkin, TabSpec } from "./types";

type SectionVariant = "pinned" | "folder" | "recent";

export default class ClassicSkin implements StartPageSkin {
	readonly style = "classic" as const;

	async render(ctx: StartPageContext): Promise<void> {
		const header = this.createHeader(ctx);
		const mainContent = this.createMainContent(ctx);
		// 经典条目没有摘要行，紧凑档通过 CSS 收窄行内边距
		mainContent.addClass("density-" + ctx.settings.listDensity);
		const footer = await createFooter(ctx);

		ctx.container.appendChild(header);
		ctx.container.appendChild(mainContent);
		ctx.container.appendChild(footer);

		ctx.container.appendChild(this.createNewNoteButton(ctx));
		const captureBtn = this.createDailyCaptureButton(ctx);
		if (captureBtn) {
			ctx.container.appendChild(captureBtn);
		}
	}

	private createHeader(ctx: StartPageContext): HTMLElement {
		const header = createElement("header", "header");

		const logo = createElement("div", "logo");
		logo.appendChild(SvgUtil.createLogoIcon());
		// 问候语替代默认标题占位，不额外占用一行
		const logoText = ctx.settings.showGreeting
			? createElement("span", "logo-text greeting", getGreetingText())
			: createElement("span", "logo-text", "Start Page for Obsidian");

		const searchBoxContainer = createElement("div", "search-box-container");
		searchBoxContainer.appendChild(createSearchBox(ctx));

		logo.appendChild(logoText);
		logo.appendChild(searchBoxContainer);

		const headerActions = createElement("div", "header-actions");
		headerActions.appendChild(createManageButton(ctx));
		if (hasUpdate(ctx)) {
			headerActions.appendChild(createUpdateBadge(ctx));
		}

		header.appendChild(logo);
		header.appendChild(headerActions);

		return header;
	}

	private createStatsSection(ctx: StartPageContext): HTMLElement {
		const statsSection = createElement("div", "stats-section");

		ctx.stats.forEach((stat) => {
			const statCard = createElement("div", `stat-card${stat.id === ID_STAT_TOTAL_SIZE ? " static" : ""}`);
			const statIcon = createElement("div", "stat-icon");
			const svg = SvgUtil.createStatIcon(stat.id);
			if (svg) {
				statIcon.appendChild(svg);
			}

			const statContent = createElement("div", "stat-content");
			statContent.appendChild(createElement("div", "stat-number", stat.data.number.toString()));
			statContent.appendChild(createElement("div", "stat-label", stat.data.label()));

			statCard.appendChild(statIcon);
			statCard.appendChild(statContent);
			statsSection.appendChild(statCard);

			// 与紧凑界面相同的语义路由：总笔记开搜索、今日编辑下钻、总大小纯信息不可点
			if (stat.id === ID_STAT_TODAY_EDITED) {
				statCard.addEventListener("click", () => {
					ctx.actions.openTodayEdited();
				});
			} else if (stat.id === ID_STAT_TOTAL_NOTES) {
				statCard.addEventListener("click", () => {
					ctx.actions.showSearch();
				});
			}
		});

		return statsSection;
	}

	private createNoteItem(ctx: StartPageContext, note: TFile | null, isPinned: boolean = false): HTMLElement | null {
		if (!note) {
			return null;
		}

		const styleSettings = isPinned ? ctx.settings.pinnedNotesStyle : ctx.settings.recentNotesStyle;

		const noteItem = createElement("div", `note-item${isPinned ? " pinned" : ""}`);
		noteItem.setAttribute("data-note-path", note.path);

		if (styleSettings.itemPadding) noteItem.style.padding = styleSettings.itemPadding;
		if (styleSettings.itemMargin) noteItem.style.margin = styleSettings.itemMargin;

		const noteIcon = createElement("div", "note-icon");
		noteIcon.appendChild(SvgUtil.createFileIcon(note.extension));

		const noteContent = createElement("div", "note-content");
		const noteTitle = createElement("div", "note-title", note.basename);
		noteTitle.setAttribute("title", note.basename);

		if (styleSettings.noteTitleFontSize) noteTitle.style.fontSize = styleSettings.noteTitleFontSize;
		if (styleSettings.noteTitleMargin) noteTitle.style.margin = styleSettings.noteTitleMargin;
		if (styleSettings.noteTitlePadding) noteTitle.style.padding = styleSettings.noteTitlePadding;

		const noteMeta = createElement("div", "note-meta");

		let folderPath = note.parent ? note.parent.path : "/";
		if (!folderPath.startsWith("/")) {
			folderPath = "/" + folderPath;
		}

		const noteDateEl = createElement("div", "note-date", MyUtil.formatDate(note.stat.mtime));
		if (styleSettings.noteDateFontSize) noteDateEl.style.fontSize = styleSettings.noteDateFontSize;

		const noteExtEl = createElement("div", "note-ext", "." + note.extension);
		noteMeta.appendChild(noteDateEl);
		noteMeta.appendChild(noteExtEl);
		noteMeta.appendChild(SvgUtil.createFolderIcon());

		const noteFolderEl = createElement("div", "note-folder", MyUtil.truncateMiddle(folderPath));
		noteFolderEl.setAttribute("title", folderPath);
		if (styleSettings.noteFolderFontSize) noteFolderEl.style.fontSize = styleSettings.noteFolderFontSize;
		noteMeta.appendChild(noteFolderEl);

		noteContent.appendChild(noteTitle);
		noteContent.appendChild(noteMeta);

		noteItem.appendChild(noteIcon);
		noteItem.appendChild(noteContent);

		ctx.bindNoteItem(noteItem, note, { isPinned });

		return noteItem;
	}

	private createNotesSection(
		ctx: StartPageContext,
		title: string,
		notes: TFile[] | null,
		variant: SectionVariant,
		icon: SVGElement,
	): HTMLElement {
		const isRecent = variant === "recent";
		const styleSettings = isRecent ? ctx.settings.recentNotesStyle : ctx.settings.pinnedNotesStyle;

		const section = createElement("section", "section");
		if (styleSettings.sectionMargin) section.style.margin = styleSettings.sectionMargin;
		if (styleSettings.sectionPadding) section.style.padding = styleSettings.sectionPadding;

		const sectionHeader = createElement("div", "section-header");
		if (styleSettings.headerMargin) sectionHeader.style.margin = styleSettings.headerMargin;
		if (styleSettings.headerPadding) sectionHeader.style.padding = styleSettings.headerPadding;

		const sectionTitle = createElement("h2", "section-title");
		sectionTitle.appendChild(icon);
		sectionTitle.appendChild(document.createTextNode(title));
		if (!isRecent && notes) {
			sectionTitle.appendChild(createElement("span", "note-count-badge", `${notes.length}`));
		}
		if (styleSettings.titleFontSize) sectionTitle.style.fontSize = styleSettings.titleFontSize;
		if (styleSettings.titleMargin) sectionTitle.style.margin = styleSettings.titleMargin;
		if (styleSettings.titlePadding) sectionTitle.style.padding = styleSettings.titlePadding;

		sectionHeader.appendChild(sectionTitle);

		let dropdown: HTMLElement | undefined;
		if (isRecent) {
			dropdown = createRecentNotesLimitDropdown(ctx);
			sectionHeader.appendChild(dropdown);
		}

		section.appendChild(sectionHeader);

		const emptyState = variant === "pinned"
			? createPinnedEmptyState(ctx)
			: createEmptyState(t(variant === "folder" ? "folder_tab_empty_hint" : "recent_empty_hint"));

		section.appendChild(createNotesList(ctx, notes, {
			isPinned: variant === "pinned",
			// 经典模式保持旧版的扁平最近列表，不按今天/本周/更早分段
			grouped: false,
			emptyState,
			renderNote: (note) => this.createNoteItem(ctx, note, variant === "pinned"),
		}));

		return section;
	}

	private createMainContent(ctx: StartPageContext): HTMLElement {
		const mainContent = createElement("main", "main-content");

		if (ctx.settings.showStatBar) {
			mainContent.appendChild(this.createStatsSection(ctx));
		}

		mainContent.appendChild(
			createContentGrid(
				ctx,
				() => this.createTabContainer(ctx),
				() => this.createNotesSection(ctx, t("recent_notes"), ctx.recentNotes, "recent", SvgUtil.createRecentNoteIcon()),
			),
		);

		return mainContent;
	}

	private createTabContainer(ctx: StartPageContext): HTMLElement {
		const tabs = this.buildTabItems(ctx);
		return createTabContainer(ctx, tabs, {
			renderPanel: (tab) => {
				if (tab.id === "pinned") {
					return this.createNotesSection(ctx, t("pinned_notes"), tab.notes, "pinned", SvgUtil.createPinnedNoteIcon());
				}
				return this.createNotesSection(ctx, tab.label, tab.notes, "folder", SvgUtil.createFolderIcon());
			},
		});
	}

	private buildTabItems(ctx: StartPageContext): TabSpec[] {
		const tabs: TabSpec[] = [
			{
				id: "pinned",
				label: t("tab_pinned"),
				notes: ctx.pinnedNotes || [],
				closable: false,
			},
		];

		if (ctx.tabFolderItems) {
			for (const item of ctx.tabFolderItems) {
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

	// 旧布局的右下悬浮按钮；右键（移动端点按）菜单补上紧凑界面 chips 中的速记/日记动作
	private createNewNoteButton(ctx: StartPageContext): HTMLElement {
		const btn = createElement("button", "start-page-new-note-btn");
		btn.setAttribute("title", t("new_note"));
		btn.setAttribute("aria-label", t("new_note"));
		btn.appendChild(SvgUtil.createNewNoteIcon());

		const openMenu = (event: MouseEvent) => {
			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle(t("new_note"))
					.setIcon("plus")
					.onClick(() => {
						ctx.actions.createNewNote();
					});
			});
			if (ctx.settings.showDailyCapture) {
				menu.addItem((item) => {
					item.setTitle(t("capture_title"))
						.setIcon("pencil")
						.onClick(() => {
							ctx.actions.openCapture();
						});
				});
			}
			if (DailyNoteUtil.getTarget(ctx.app)) {
				menu.addItem((item) => {
					item.setTitle(t("open_daily_note"))
						.setIcon("calendar")
						.onClick(() => {
							ctx.actions.openDailyNote();
						});
				});
			}
			menu.showAtMouseEvent(event);
		};

		btn.addEventListener("click", (event) => {
			// 触屏没有可靠右键，点按改为弹出与紧凑界面一致的菜单
			if (Platform.isMobile) {
				openMenu(event);
				return;
			}
			ctx.actions.createNewNote();
		});

		btn.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			event.stopPropagation();
			openMenu(event);
		});

		return btn;
	}

	private createDailyCaptureButton(ctx: StartPageContext): HTMLElement | null {
		// 未启用核心 Daily notes 插件时隐藏速记入口
		if (!ctx.settings.showDailyCapture || !DailyNoteUtil.getTarget(ctx.app)) {
			return null;
		}
		const btn = createElement("button", "start-page-capture-btn");
		btn.setAttribute("title", t("capture_title"));
		btn.setAttribute("aria-label", t("capture_title"));
		btn.appendChild(SvgUtil.createCaptureIcon());
		btn.addEventListener("click", () => {
			ctx.actions.openCapture();
		});
		return btn;
	}
}
