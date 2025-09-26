import type { SVGTag } from "./types";
import { App, TFolder, TFile, Menu, Notice, Platform } from "obsidian";
import StartPagePlugin from "./main";
import { t } from "./i18n";
import { VIEW_TYPE_START_PAGE, StartPageView } from "./startpageview";

const STAT_TOTAL_NOTES = "totalNotes";
const STAT_TODAY_EDITED = "todayEdited";
const STAT_TOTAL_SIZE = "totalSize";

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
	private stats = [
		{
			id: STAT_TOTAL_NOTES,
			data: {
				number: 0,
				label: function () {
					return t("total_notes");
				},
				icon: [
					{ tagName: "path", attributes: { d: "M14 2H6A2 2 0 0 0 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8L14 2Z" } },
					{ tagName: "path", attributes: { d: "M14 2V8H20" } },
				],
			},
		},
		{
			id: STAT_TODAY_EDITED,
			data: {
				number: 0,
				label: function () {
					return t("today_edited");
				},
				icon: [
					{ tagName: "path", attributes: { d: "M12 8V12L15 15" } },
					{ tagName: "circle", attributes: { cx: 12, cy: 12, r: 10, stroke: "currentColor", "stroke-width": 2 } },
				],
			},
		},
		{
			id: STAT_TOTAL_SIZE,
			data: {
				number: "0",
				label: function () {
					return t("total_size");
				},
				icon: [
					{
						tagName: "rect",
						attributes: {
							x: "3",
							y: "6",
							width: "18",
							height: "12",
							rx: "2",
							ry: "2",
							stroke: "currentColor",
							"stroke-width": "2",
							fill: "none",
						},
					},
					{
						tagName: "circle",
						attributes: {
							cx: "7",
							cy: "12",
							r: "1",
							fill: "currentColor",
						},
					},
					{
						tagName: "path",
						attributes: {
							d: "M11 10H17",
							stroke: "currentColor",
							"stroke-width": "2",
							"stroke-linecap": "round",
						},
					},
					{
						tagName: "path",
						attributes: {
							d: "M11 14H15",
							stroke: "currentColor",
							"stroke-width": "2",
							"stroke-linecap": "round",
						},
					},
				],
			},
		},
	];
	private pinnedNotes: TFile[] | null = null;
	private recentNotes: TFile[] | null = null;

	constructor(app: App, plugin: StartPagePlugin, container: Element) {
		this.app = app;
		this.plugin = plugin;
		this.container = container;
	}

	public createStartPage(pinnedNotes: TFile[] | null, recentNotes: TFile[] | null): void {
		this.initData(pinnedNotes, recentNotes);

		this.container.empty();
		this.container.addClass("start-page-container");

		const mainContent = this.createMainContent();
		const footer = this.createFooter();

		if (Platform.isDesktop) {
			const header = this.createHeader();
			this.container.appendChild(header);
		}
		this.container.appendChild(mainContent);
		this.container.appendChild(footer);
	}

	private initData(pinnedNotes: TFile[] | null, recentNotes: TFile[] | null): void {
		this.pinnedNotes = pinnedNotes;
		this.recentNotes = recentNotes;

		this.stats.forEach((stat) => {
			if (stat.id === STAT_TOTAL_NOTES) {
				stat.data.number = this.app.vault.getMarkdownFiles().length;
			} else if (stat.id === STAT_TODAY_EDITED) {
				stat.data.number = this.getTodayModifiedNoteCount();
			} else if (stat.id === STAT_TOTAL_SIZE) {
				stat.data.number = this.formatSize(this.getTotalSize());
			}
		});
	}

	// 创建头部
	private createHeader(): HTMLElement {
		const header = this.createElement("header", "header");

		// Logo
		const logo = this.createElement("div", "logo");
		const logoIcon = this.createSVG(
			[
				{ tagName: "path", attributes: { d: "M12 2L2 7L12 12L22 7L12 2Z", "stroke-linecap": "none" } },
				{ tagName: "path", attributes: { d: "M2 17L12 22L22 17", "stroke-linecap": "none" } },
				{ tagName: "path", attributes: { d: "M2 12L12 17L22 12", "stroke-linecap": "none" } },
			],
			"logo-icon"
		);
		const logoText = this.createElement("span", "logo-text", "Start Page for Obsidian");

		logo.appendChild(logoIcon);
		logo.appendChild(logoText);

		// Header actions
		const headerActions = this.createElement("div", "header-actions");

		const newNoteBtn = this.createElement("button");
		const newNoteIcon = this.createSVG(
			[
				{ tagName: "path", attributes: { d: "M12 5V19" } },
				{ tagName: "path", attributes: { d: "M5 12H19" } },
			],
			"new-note-icon"
		);
		newNoteBtn.addEventListener("click", async () => {
			const parent: TFolder = this.app.fileManager.getNewFileParent("");
			if (!parent) {
				console.error("Unable to get the currently selected directory");
				return;
			}

			let newFilePath = parent.path === "/" ? "Untitled.md" : parent.path + "/Untitled.md";
			let index = 1;
			let existFile = this.app.vault.getAbstractFileByPath(newFilePath);
			while (existFile) {
				newFilePath = parent.path === "/" ? `Untitled ${index++}.md` : parent.path + `/Untitled ${index++}.md`;
				existFile = this.app.vault.getAbstractFileByPath(newFilePath);
			}

			const file = await this.app.vault.create(newFilePath, "");
			this.app.workspace.openLinkText(file.path, "", false);
		});
		newNoteBtn.appendChild(newNoteIcon);
		newNoteBtn.appendChild(document.createTextNode(t("new_note")));

		headerActions.appendChild(newNoteBtn);

		header.appendChild(logo);
		header.appendChild(headerActions);

		return header;
	}

	// 创建统计卡片
	private createStatsSection(): HTMLElement {
		const statsSection = this.createElement("div", "stats-section");

		this.stats.forEach((stat) => {
			const statCard = this.createElement("div", "stat-card");
			const statIcon = this.createElement("div", "stat-icon");
			const svg = this.createSVG(stat.data.icon);
			statIcon.appendChild(svg);

			const statContent = this.createElement("div", "stat-content");
			const statNumber = this.createElement("div", "stat-number", stat.data.number.toString());
			const statLabel = this.createElement("div", "stat-label", stat.data.label());

			statContent.appendChild(statNumber);
			statContent.appendChild(statLabel);
			statCard.appendChild(statIcon);
			statCard.appendChild(statContent);
			statsSection.appendChild(statCard);
		});

		return statsSection;
	}

	// 创建笔记项
	private createNoteItem(note: TFile | null, isPinned: boolean = false): HTMLElement | null {
		if (!note) {
			return null;
		}

		const noteItem = this.createElement("div", `note-item${isPinned ? " pinned" : ""}`);

		noteItem.addEventListener("click", async () => {
			const existingLeaf = this.app.workspace.getLeavesOfType("markdown").find((leaf) => {
				const state = leaf.view.getState();
				return state["file"] === note.path;
			});

			if (existingLeaf) {
				await this.app.workspace.revealLeaf(existingLeaf);
			} else {
				this.app.workspace.openLinkText(note.path, "", false);
			}
		});

		// 为置顶笔记添加右键菜单
		if (isPinned) {
			noteItem.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				event.stopPropagation();

				const menu = new Menu();
				menu.addItem((item) => {
					item.setTitle(t("remove_from_pinned_notes"))
						.setIcon("pin-off")
						.onClick(async () => {
							// 从置顶笔记中移除
							this.plugin.settings.pinnedNotes = this.plugin.settings.pinnedNotes.filter((path) => path !== note.path);
							await this.plugin.saveSettings();

							// 刷新启动页面
							this.refreshStartPage();
						});
				});

				menu.showAtMouseEvent(event);
			});
		}

		// 为最近笔记添加右键菜单
		if (!isPinned) {
			noteItem.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				event.stopPropagation();

				const menu = new Menu();
				menu.addItem((item) => {
					item.setTitle(t("add_to_pinned_notes"))
						.setIcon("pin")
						.onClick(async () => {
							// 若笔记已置顶，则不重复添加
							if (this.plugin.settings.pinnedNotes.includes(note.path)) {
								new Notice(t("note_already_pinned"));
								return;
							}
							// 将笔记添加到置顶笔记
							this.plugin.settings.pinnedNotes.push(note.path);
							await this.plugin.saveSettings();

							// 刷新启动页面
							this.refreshStartPage();
						});
				});

				menu.showAtMouseEvent(event);
			});
		}

		const noteContent = this.createElement("div", "note-content");
		const noteTitle = this.createElement("div", "note-title", note.basename);

		let metaText = this.formatDate(note.stat.mtime);
		const noteMeta = this.createElement("div", "note-meta", metaText);

		let folderPath = note.parent ? note.parent.name : "";
		folderPath = folderPath || "/";
		// 创建文件夹图标SVG元素
		const folderIcon = this.createSVG(
			[{ tagName: "path", attributes: { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" } }],
			"folder-icon"
		);
		folderIcon.setAttribute("width", "16");
		folderIcon.setAttribute("height", "16");

		// 创建路径文本
		const pathText = document.createTextNode(` ${folderPath}`);

		// 添加空格、图标和路径到meta元素
		const folderPathElem = this.createElement("div", "note-path");
		folderPathElem.appendChild(folderIcon);
		folderPathElem.appendChild(pathText);
		noteMeta.appendChild(folderPathElem);

		noteTitle.setAttribute("title", note.basename);
		noteContent.appendChild(noteTitle);

		// 添加内容预览
		this.addContentPreview(noteContent, note, isPinned);

		noteContent.appendChild(noteMeta);
		noteItem.appendChild(noteContent);

		return noteItem;
	}

	// 添加内容预览
	private async addContentPreview(noteContent: HTMLElement, note: TFile, isPinned: boolean): Promise<void> {
		try {
			const content = await this.app.vault.cachedRead(note);
			const previewText = this.extractPreviewText(content, isPinned);

			if (previewText.trim()) {
				const previewElement = this.createElement("div", "note-preview", previewText);
				// 在noteMeta之前插入预览内容
				const noteMeta = noteContent.querySelector(".note-meta");
				if (noteMeta) {
					noteContent.insertBefore(previewElement, noteMeta);
				} else {
					noteContent.appendChild(previewElement);
				}
			}
		} catch (error) {
			// 如果读取文件失败，不显示预览
			console.warn(`Failed to read content for ${note.path}:`, error);
		}
	}

	// 提取预览文本
	private extractPreviewText(content: string, isPinned: boolean): string {
		// 移除 markdown 语法和空行
		const cleanContent = content
			.replace(/^#+\s+/gm, "") // 移除标题标记
			.replace(/\*\*(.*?)\*\*/g, "$1") // 移除粗体标记
			.replace(/\*(.*?)\*/g, "$1") // 移除斜体标记
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 移除链接，保留文本
			.replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // 移除图片
			.replace(/```[\s\S]*?```/g, "") // 移除代码块
			.replace(/`([^`]+)`/g, "$1") // 移除行内代码标记
			.replace(/^\s*[-*+]\s+/gm, "") // 移除列表标记
			.replace(/^\s*\d+\.\s+/gm, "") // 移除有序列表标记
			.replace(/^\s*>\s+/gm, "") // 移除引用标记
			.replace(/\n\s*\n/g, "\n") // 合并多个空行为单个换行
			.trim();

		if (!cleanContent) {
			return "";
		}

		const lines = cleanContent.split("\n").filter((line) => line.trim());

		return lines.join("\n");
	}

	// 创建笔记区块
	private createNotesSection(title: string, notes: TFile[] | null, isPinned: boolean = false, icon: SVGTag[] = []): HTMLElement {
		const section = this.createElement("section", "section");
		const sectionHeader = this.createElement("div", "section-header");

		const sectionTitle = this.createElement("h2", "section-title");
		if (icon.length) {
			const titleIcon = this.createSVG(icon, "section-icon");
			sectionTitle.appendChild(titleIcon);
		}
		sectionTitle.appendChild(document.createTextNode(title));

		if (isPinned) {
			sectionHeader.appendChild(sectionTitle);
		} else {
			const dropdownDiv = this.createRecentNotesLimitDropdown();
			sectionHeader.appendChild(sectionTitle);
			sectionHeader.appendChild(dropdownDiv);
		}

		const notesList = this.createElement("div", "notes-list");
		if (notes) {
			notes.forEach((note) => {
				const noteItem = this.createNoteItem(note, isPinned);
				if (noteItem) {
					notesList.appendChild(noteItem);

					// 若不是最后一个笔记，添加分隔线
					if (note !== notes[notes.length - 1]) {
						const sectionDivider = this.createElement("div", "section-divider");
						notesList.appendChild(sectionDivider);
					}
				}
			});
		}

		section.appendChild(sectionHeader);
		section.appendChild(notesList);

		return section;
	}

	// 创建主要内容网格
	private createContentGrid(): HTMLElement {
		const contentGrid = this.createElement("div", "content-grid");

		// 置顶笔记
		const pinnedSection = this.createNotesSection(t("pinned_notes"), this.pinnedNotes, true, []);
		pinnedSection.classList.add("pinned-notes");

		// 最近编辑
		const recentSection = this.createNotesSection(t("recent_notes"), this.recentNotes, false, []);
		recentSection.classList.add("recent-notes");

		contentGrid.appendChild(pinnedSection);
		contentGrid.appendChild(recentSection);

		return contentGrid;
	}

	// 创建主要内容区域
	private createMainContent(): HTMLElement {
		const mainContent = this.createElement("main", "main-content");

		if (Platform.isDesktop) {
			const statsSection = this.createStatsSection();
			mainContent.appendChild(statsSection);
		}
		const contentGrid = this.createContentGrid();
		mainContent.appendChild(contentGrid);

		return mainContent;
	}

	// 创建页脚版权信息
	private createFooter(): HTMLElement {
		const footer = this.createElement("footer", "footer");
		const love = this.createElement("p", "", `❤️ Love what you love, and love what you do. ❤️`);
		footer.appendChild(love);

		return footer;
	}

	// 工具函数
	private createSVG(tags: SVGTag[], className: string | null = null): SVGSVGElement {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("fill", "none");
		svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
		if (className) svg.setAttribute("class", className);

		tags.forEach((tag) => {
			const element = document.createElementNS("http://www.w3.org/2000/svg", tag.tagName);

			if (tag.tagName === "path" && !tag.attributes.fill) {
				tag.attributes.stroke = tag.attributes.stroke || "currentColor";
				tag.attributes["stroke-width"] = tag.attributes["stroke-width"] || "2";
				tag.attributes["stroke-linecap"] = tag.attributes["stroke-linecap"] || "round";
				tag.attributes["stroke-linejoin"] = tag.attributes["stroke-linejoin"] || "round";
			}

			for (let [key, value] of Object.entries(tag.attributes)) {
				if (value === undefined) continue;
				if (typeof value === "number") value = value.toString();

				element.setAttribute(key, value);
			}

			svg.appendChild(element);
		});

		return svg;
	}

	private createElement(tag: string, className: string = "", textContent: string = ""): HTMLElement {
		const element = document.createElement(tag);
		if (className) element.className = className;
		if (textContent) element.textContent = textContent;
		return element;
	}

	private refreshStartPage(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
		leaves.forEach((leaf) => {
			if (leaf.view instanceof StartPageView) {
				leaf.view.renderContent();
				return;
			}
		});
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
			this.refreshStartPage();
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
		today.setHours(0, 0, 0, 0); // 设置为今天的凌晨 0 点

		const markdownFiles: TFile[] = this.app.vault.getMarkdownFiles();

		const count = markdownFiles.filter((file) => {
			const modifiedTime = file.stat.mtime; // 毫秒时间戳
			return modifiedTime >= today.getTime();
		}).length;

		return count;
	}

	getTotalSize(): number {
		const markdownFiles: TFile[] = this.app.vault.getMarkdownFiles();
		let totalSize: number = 0;

		markdownFiles.forEach((file) => {
			totalSize += file.stat.size;
		});

		return totalSize;
	}

	private formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		// Less than 24 hours
		if (diff < 24 * 60 * 60 * 1000) {
			return date.toLocaleTimeString("zh-CN", {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			});
		}

		// Less than 7 days
		if (diff < 7 * 24 * 60 * 60 * 1000) {
			const days = Math.floor(diff / (24 * 60 * 60 * 1000));
			return t("days_ago").replace("{days}", days.toString());
		}

		// Same year
		if (date.getFullYear() === now.getFullYear()) {
			return `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
		}

		// Otherwise show full date
		return date.toLocaleDateString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	private formatSize(size: number): string {
		if (size < 1024) {
			return size + "B";
		} else if (size < 1024 * 1024) {
			return (size / 1024).toFixed(0) + "KB";
		} else if (size < 1024 * 1024 * 1024) {
			return (size / (1024 * 1024)).toFixed(0) + "MB";
		} else {
			return (size / (1024 * 1024 * 1024)).toFixed(0) + "GB";
		}
	}
}
