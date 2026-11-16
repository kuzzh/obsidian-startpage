import { Menu, TFile } from "obsidian";
import { t } from "@/i18n";
import { MyUtil } from "@/utils/myutil";
import { DailyNoteUtil } from "@/utils/dailynoteutil";
import { ID_STAT_TODAY_EDITED, ID_STAT_TOTAL_NOTES, ID_STAT_TOTAL_SIZE } from "@/types";
import {
	createActivityGrid,
	createContentGrid,
	createElement,
	createEmptyState,
	createFooter,
	createGroupTitleRow,
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

export default class CompactSkin implements StartPageSkin {
	readonly style = "compact" as const;
	private pendingPreviewItems: { el: HTMLElement; file: TFile }[] = [];

	async render(ctx: StartPageContext): Promise<void> {
		this.pendingPreviewItems = [];

		const header = this.createHeader(ctx);
		const mainContent = this.createMainContent(ctx);
		// 列表密度作用于整个内容区，紧凑档隐藏摘要与元信息行
		mainContent.addClass("density-" + ctx.settings.listDensity);
		const footer = await createFooter(ctx);

		ctx.container.appendChild(header);
		ctx.container.appendChild(mainContent);
		ctx.container.appendChild(footer);

		this.flushNotePreviews(ctx);
	}

	private createHeader(ctx: StartPageContext): HTMLElement {
		// 命令条头部（变体 C）：问候与命令条同行，chips 行随下，垂直空间全部让给列表
		const header = createElement("header", "command-header" + (ctx.settings.showGreeting ? "" : " no-greeting"));

		const greetingRow = createElement("div", "command-greeting-row");
		if (ctx.settings.showGreeting) {
			greetingRow.appendChild(createElement("div", "command-greeting", getGreetingText()));
		}

		const bar = createElement("div", "command-bar");
		bar.appendChild(createElement("span", "command-prompt", "›"));
		bar.appendChild(createSearchBox(ctx));
		bar.appendChild(createElement("span", "command-kbd", t("kbd_any_key")));
		bar.appendChild(createElement("span", "command-kbd", t("kbd_ctrl_enter")));
		bar.appendChild(createManageButton(ctx));

		greetingRow.appendChild(bar);
		header.appendChild(greetingRow);

		// 快捷 chips 行：原浮动按钮的动作全部收编于此，行尾接统计文字与热力图
		const chips = createElement("div", "chip-row");
		const newChip = createElement("button", "chip chip-primary", t("new_note"));
		newChip.addEventListener("click", () => {
			ctx.actions.createNewNote();
		});
		chips.appendChild(newChip);

		const dailyTarget = DailyNoteUtil.getTarget(ctx.app);
		if (ctx.settings.showDailyCapture && dailyTarget) {
			const captureChip = createElement("button", "chip", t("capture_title"));
			captureChip.addEventListener("click", () => {
				ctx.actions.openCapture();
			});
			chips.appendChild(captureChip);
		}
		if (dailyTarget) {
			// 复用核心命令：创建/打开/模板/定位行为全部随核心插件
			const dailyChip = createElement("button", "chip", t("open_daily_note"));
			dailyChip.addEventListener("click", () => {
				ctx.actions.openDailyNote();
			});
			chips.appendChild(dailyChip);
		}

		if (hasUpdate(ctx)) {
			chips.appendChild(createUpdateBadge(ctx));
		}

		// 移动端：单个 ＋ 按钮弹出菜单（触屏无 hover 且横向空间有限），桌面由 CSS 隐藏；
		// 无 Daily notes 时 ＋ 直接新建，省一次菜单点击
		const fab = createElement("button", "chip-fab");
		fab.setAttribute("aria-label", t("new_note"));
		fab.textContent = "+";
		fab.addEventListener("click", (event) => {
			if (!dailyTarget) {
				ctx.actions.createNewNote();
				return;
			}
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
			menu.addItem((item) => {
				item.setTitle(t("open_daily_note"))
					.setIcon("calendar")
					.onClick(() => {
						ctx.actions.openDailyNote();
					});
			});
			menu.showAtMouseEvent(event);
		});
		chips.appendChild(fab);

		chips.appendChild(createElement("div", "chip-spacer"));

		if (ctx.settings.showStatBar) {
			chips.appendChild(this.createStatsText(ctx));
		}
		if (ctx.settings.showActivityHeatmap) {
			chips.appendChild(createActivityGrid(ctx));
		}

		header.appendChild(chips);

		return header;
	}

	private createStatsText(ctx: StartPageContext): HTMLElement {
		const statsText = createElement("div", "stats-text");

		ctx.stats.forEach((stat, index) => {
			if (index > 0) {
				statsText.appendChild(createElement("span", "stat-text-separator", "·"));
			}
			// 与卡片时期相同的语义路由：总笔记开搜索、今日编辑下钻、总大小纯信息不可点
			const item = createElement("span", `stat-text${stat.id === ID_STAT_TOTAL_SIZE ? " static" : ""}`);
			const number = createElement("span", "stat-text-number", stat.data.number.toString());
			item.appendChild(number);
			item.appendText(` ${stat.data.label()}`);

			if (stat.id === ID_STAT_TODAY_EDITED) {
				item.addEventListener("click", () => {
					ctx.actions.openTodayEdited();
				});
			} else if (stat.id === ID_STAT_TOTAL_NOTES) {
				item.addEventListener("click", () => {
					ctx.actions.showSearch();
				});
			}
			statsText.appendChild(item);
		});

		return statsText;
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

		// 紧凑三行式（参考 Notebook Navigator）：加粗标题 / 摘要 / 时间·路径；行间分隔线交给 CSS
		const noteTitleRow = createElement("div", "note-title-row");
		const noteTitle = createElement("div", "note-title", note.basename);
		noteTitle.setAttribute("title", note.basename);

		if (styleSettings.noteTitleFontSize) noteTitle.style.fontSize = styleSettings.noteTitleFontSize;
		if (styleSettings.noteTitleMargin) noteTitle.style.margin = styleSettings.noteTitleMargin;
		if (styleSettings.noteTitlePadding) noteTitle.style.padding = styleSettings.noteTitlePadding;

		noteTitleRow.appendChild(noteTitle);

		let folderPath = note.parent ? note.parent.path : "/";
		if (!folderPath.startsWith("/")) {
			folderPath = "/" + folderPath;
		}

		const notePreview = createElement("div", "note-preview");

		const noteDateEl = createElement("span", "note-date", MyUtil.formatDate(note.stat.mtime));
		if (styleSettings.noteDateFontSize) noteDateEl.style.fontSize = styleSettings.noteDateFontSize;

		const noteFolderEl = createElement("span", "note-folder", MyUtil.truncateMiddle(folderPath));
		noteFolderEl.setAttribute("title", folderPath);
		if (styleSettings.noteFolderFontSize) noteFolderEl.style.fontSize = styleSettings.noteFolderFontSize;

		const noteMetaRow = createElement("div", "note-meta-row");
		noteMetaRow.appendChild(noteDateEl);
		noteMetaRow.appendChild(createElement("span", "note-meta-separator", "·"));
		noteMetaRow.appendChild(noteFolderEl);
		noteMetaRow.appendChild(createElement("span", "note-meta-separator", "·"));
		noteMetaRow.appendChild(createElement("span", "note-type", note.extension.toUpperCase()));

		const noteMain = createElement("div", "note-main");
		noteMain.appendChild(noteTitleRow);
		noteMain.appendChild(notePreview);
		noteMain.appendChild(noteMetaRow);
		noteItem.appendChild(noteMain);

		this.pendingPreviewItems.push({ el: noteItem, file: note });

		// 缩略图：首个能解析的内嵌图片，浏览器原生 lazy 加载；无图不占位
		const imageFile = this.getFirstImageFile(ctx, note);
		if (imageFile) {
			const thumb = createElement("div", "note-thumb");
			const img = document.createElement("img");
			img.loading = "lazy";
			img.alt = "";
			img.src = ctx.app.vault.getResourcePath(imageFile);
			thumb.appendChild(img);
			noteItem.appendChild(thumb);
		}

		ctx.bindNoteItem(noteItem, note, { isPinned });

		return noteItem;
	}

	// 首个能解析到库内文件的内嵌图片，用于条目缩略图
	private getFirstImageFile(ctx: StartPageContext, file: TFile): TFile | null {
		const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"]);
		const cache = ctx.app.metadataCache.getFileCache(file);
		for (const embed of cache?.embeds ?? []) {
			const dest = ctx.app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
			if (dest && imageExtensions.has(dest.extension.toLowerCase())) {
				return dest;
			}
		}
		return null;
	}

	// 渲染后异步填充摘要：cachedRead 走 Obsidian 内容缓存，不阻塞整页渲染；二进制文件无摘要
	private flushNotePreviews(ctx: StartPageContext): void {
		const textExtensions = new Set(["md", "markdown", "mdtxt", "txt"]);
		const items = this.pendingPreviewItems;
		this.pendingPreviewItems = [];
		for (const { el, file } of items) {
			if (!textExtensions.has(file.extension.toLowerCase())) {
				continue;
			}
			void ctx.app.vault.cachedRead(file).then((content) => {
				if (!el.isConnected) {
					return;
				}
				const preview = el.querySelector(".note-preview");
				if (preview) {
					preview.textContent = this.extractPreview(content);
				}
			});
		}
	}

	private extractPreview(content: string): string {
		let text = content;
		// 去 frontmatter（循环剥离：测试环境存在被破坏的多重块）
		while (text.startsWith("---\n")) {
			const end = text.indexOf("\n---", 4);
			if (end === -1) {
				break;
			}
			text = text.slice(text.indexOf("\n", end + 1) + 1);
		}
		// 多行正文按空格合并成一段（换行符替换为空格），展示时由 CSS 两行截断
		const parts: string[] = [];
		let inFence = false;
		for (const rawLine of text.split("\n")) {
			const line = rawLine.trim();
			if (line.startsWith("```")) {
				inFence = !inFence;
				continue;
			}
			if (inFence || !line || line === "---" || (line.startsWith("#") && !line.startsWith("#tag"))) {
				continue;
			}
			// 残留的裸 YAML 键（如 "tags:"）不作为正文
			if (/^[A-Za-z][\w-]*:\s*$/.test(line)) {
				continue;
			}
			const plain = line
				.replace(/!\[\[[^\]]*\]\]/g, "")
				.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
				.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
				.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
				.replace(/(\*\*|\*|__|_|==|~~|`)/g, "")
				.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
				.replace(/^\s*>\s?/, "")
				.replace(/(^|\s)#[^\s#]+/g, "$1")
				.trim();
			if (plain) {
				parts.push(plain);
			}
		}
		const joined = parts.join(" ");
		// 上限放宽到 160 字符：两行可容纳约此数量，超出部分由 CSS line-clamp 截断
		return joined.length > 160 ? joined.slice(0, 160) + "…" : joined;
	}

	// 最近笔记：无独立 header；「最近 · 今天」首行右侧挂数量下拉（参照图布局）
	private createRecentSection(ctx: StartPageContext): HTMLElement {
		const styleSettings = ctx.settings.recentNotesStyle;

		const section = createElement("section", "section");
		if (styleSettings.sectionMargin) section.style.margin = styleSettings.sectionMargin;
		if (styleSettings.sectionPadding) section.style.padding = styleSettings.sectionPadding;

		const dropdown = createRecentNotesLimitDropdown(ctx);
		const notes = ctx.recentNotes;
		if (notes && notes.length > 0) {
			section.appendChild(
				createNotesList(ctx, notes, {
					isPinned: false,
					grouped: true,
					emptyState: createEmptyState(t("recent_empty_hint")),
					firstRowExtra: dropdown,
					renderNote: (note) => this.createNoteItem(ctx, note, false),
				}),
			);
		} else {
			// 空列表也保留首行，数量下拉仍有入口
			const list = createElement("div", "notes-list");
			list.appendChild(createGroupTitleRow(`${t("recent_short")} · ${t("recent_group_today")}`, dropdown));
			list.appendChild(createEmptyState(t("recent_empty_hint")));
			section.appendChild(list);
		}

		return section;
	}

	private createMainContent(ctx: StartPageContext): HTMLElement {
		const mainContent = createElement("main", "main-content");
		mainContent.appendChild(
			createContentGrid(
				ctx,
				() => this.createTabContainer(ctx),
				() => this.createRecentSection(ctx),
			),
		);
		return mainContent;
	}

	private createTabContainer(ctx: StartPageContext): HTMLElement {
		const tabs = this.buildTabItems(ctx);
		return createTabContainer(ctx, tabs, {
			// 计数并入 tab 标签，替代原先面板内的标题+徽标
			decorateTab: (tabItem, tab) => {
				if (tab.id === "pinned") {
					tabItem.appendChild(createElement("span", "tab-count", `${tab.notes.length}`));
				}
			},
			// tab 栏即面板 header，计数在标签内；面板只留列表
			renderPanel: (tab) => createNotesList(ctx, tab.notes, {
				isPinned: tab.id === "pinned",
				emptyState: tab.id === "pinned"
					? createPinnedEmptyState(ctx)
					: createEmptyState(t("folder_tab_empty_hint")),
				renderNote: (note) => this.createNoteItem(ctx, note, tab.id === "pinned"),
			}),
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
}
