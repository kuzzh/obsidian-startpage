import { ID_STAT_TOTAL_NOTES, ID_STAT_TODAY_EDITED, ID_STAT_TOTAL_SIZE } from "@/types";
import { App, TFolder, TFile, Menu, Platform } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import { VIEW_TYPE_START_PAGE, StartPageView } from "@/views/startpageview";
import FooterTextUtil from "@/utils/footertextutil";
import SvgUtil from "@/utils/svgutil";
import { MyUtil } from "@/utils/myutil";
import SearchModal from "@/views/searchmodal";

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
	private globalKeyHandler: (e: KeyboardEvent) => void;
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

	constructor(app: App, plugin: StartPagePlugin, container: Element) {
		this.app = app;
		this.plugin = plugin;
		this.container = container;
	}

	public async createStartPage(pinnedNotes: TFile[] | null, recentNotes: TFile[] | null): Promise<void> {
		this.initData(pinnedNotes, recentNotes);

		this.container.empty();
		this.container.addClass("start-page-container");

		const header = this.createHeader();
		const mainContent = this.createMainContent();
		const footer = await this.createFooter();

		this.container.appendChild(header);
		this.container.appendChild(mainContent);
		this.container.appendChild(footer);

		this.setupGlobalKeyListener();
	}

	public destroy(): void {
		this.removeGlobalKeyListener();
	}

	private initData(pinnedNotes: TFile[] | null, recentNotes: TFile[] | null): void {
		this.pinnedNotes = pinnedNotes;
		this.recentNotes = recentNotes;

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

		// Logo
		const logo = this.createElement("div", "logo");
		const logoIcon = SvgUtil.createLogoIcon();
		const logoText = this.createElement("span", "logo-text", "Start Page for Obsidian");

		this.searchBox = this.createElement("input", "search-box", "") as HTMLInputElement;
		this.searchBox.type = "text";
		this.searchBox.placeholder = t("search_placeholder");
		this.searchBox.addEventListener("click", (e) => {
			this.showSearchModal();
		});
		
		this.searchBox.addEventListener("focus", (e) => {
			(e.target as HTMLInputElement).blur();
		});

		const searchBoxContainer = this.createElement("div", "search-box-container");
		searchBoxContainer.appendChild(this.searchBox);

		logo.appendChild(logoIcon);
		logo.appendChild(logoText);
		logo.appendChild(searchBoxContainer);

		// Header actions (Update badge if available)
		const headerActions = this.createElement("div", "header-actions");

		// Check if there's a new version available
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
			const statCard = this.createElement("div", "stat-card");
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

			statCard.addEventListener("click", () => {
				// open search modal
				this.showSearchModal();
			});
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
		
		if (styleSettings.itemPadding) noteItem.style.padding = styleSettings.itemPadding;
		if (styleSettings.itemMargin) noteItem.style.margin = styleSettings.itemMargin;

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

		if (isPinned) {
			noteItem.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				event.stopPropagation();

				const menu = new Menu();
				menu.addItem((item) => {
					item.setTitle(t("remove_from_pinned_notes"))
						.setIcon("pin-off")
						.onClick(async () => {
							this.plugin.settings.pinnedNotes = this.plugin.settings.pinnedNotes.filter((path) => path !== note.path);
							await this.plugin.saveSettings();

							this.refreshStartPage();
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
		const folderIcon = SvgUtil.createFolderIcon();
		noteMeta.appendChild(folderIcon);
		
		const noteFolderEl = this.createElement("div", "note-folder", MyUtil.truncateMiddle(folderPath));
		if (styleSettings.noteFolderFontSize) noteFolderEl.style.fontSize = styleSettings.noteFolderFontSize;

		noteMeta.appendChild(noteFolderEl);

		noteTitle.setAttribute("title", note.basename);
		noteContent.appendChild(noteTitle);
		noteContent.appendChild(noteMeta);

		const noteActions = this.createElement("div", "note-actions");
		const editBtn = this.createElement("button", "btn-icon");
		const editIcon = SvgUtil.createEditIcon();
		editBtn.appendChild(editIcon);
		noteActions.appendChild(editBtn);

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
		if (styleSettings.titleFontSize) sectionTitle.style.fontSize = styleSettings.titleFontSize;
		if (styleSettings.titleMargin) sectionTitle.style.margin = styleSettings.titleMargin;
		if (styleSettings.titlePadding) sectionTitle.style.padding = styleSettings.titlePadding;

		if (isPinned) {
			const actionBtn = this.createElement("button", "btn btn-text", t("manage"));
			actionBtn.addEventListener("click", () => {
				const setting = this.app.setting;
				setting.open();

				setTimeout(() => {
					setting.openTabById(this.plugin.manifest.id);
				}, 100);
			});
			sectionHeader.appendChild(sectionTitle);
			sectionHeader.appendChild(actionBtn);
		} else {
			const dropdownDiv = this.createRecentNotesLimitDropdown();
			sectionHeader.appendChild(sectionTitle);
			sectionHeader.appendChild(dropdownDiv);
		}

		const notesList = this.createElement("div", "notes-list");
		if (styleSettings.listGap) notesList.style.gap = styleSettings.listGap;

		if (notes) {
			notes.forEach((note) => {
				const noteItem = this.createNoteItem(note, isPinned);
				if (noteItem) {
					notesList.appendChild(noteItem);
				}
			});
		}

		section.appendChild(sectionHeader);
		section.appendChild(notesList);

		return section;
	}

	private createContentGrid(): HTMLElement {
		const contentGrid = this.createElement("div", "content-grid");

		const pinnedSection = this.createNotesSection(t("pinned_notes"), this.pinnedNotes, true, SvgUtil.createPinnedNoteIcon());
		pinnedSection.classList.add("pinned-notes");

		const recentSection = this.createNotesSection(t("recent_notes"), this.recentNotes, false, SvgUtil.createRecentNoteIcon());
		recentSection.classList.add("recent-notes");

		contentGrid.appendChild(pinnedSection);
		contentGrid.appendChild(recentSection);

		return contentGrid;
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

	private setupGlobalKeyListener(): void {
		this.globalKeyHandler = (e: KeyboardEvent) => {
			// 检查当前活动视图是否是 start page
			const activeView = this.app.workspace.getActiveViewOfType(StartPageView);
			if (!activeView) {
				return;
			}

			// 排除功能键和组合键
			if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
				return;
			}

			// 只处理可打印字符（字母、数字等）
			if (e.key.length !== 1) {
				return;
			}

			// 排除在输入框中输入的情况
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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

		document.addEventListener("keydown", this.globalKeyHandler, true);
	}

	private showSearchModal(): void {
		if (document.querySelector('.modal-container')) {
			return;
		}

		const modal = new SearchModal(
			this.app,
			this.plugin,
			(item: TFile) => {
				this.app.workspace.openLinkText(item.path, "", false);
			},
			this.initialQuery
		);
		modal.open();
		this.initialQuery = "";
	}

	private removeGlobalKeyListener(): void {
		if (this.globalKeyHandler) {
			document.removeEventListener("keydown", this.globalKeyHandler, true);
		}
	}

	/**
	 * Check if there's a new version available
	 */
	private hasUpdate(): boolean {
		const currentVersion = this.plugin.manifest.version;
		const latestVersion = this.plugin.settings.latestVersion;
		
		if (!latestVersion) {
			return false;
		}

		// Simple version comparison
		const current = currentVersion.split(".").map(Number);
		const latest = latestVersion.split(".").map(Number);

		for (let i = 0; i < Math.max(current.length, latest.length); i++) {
			const c = current[i] || 0;
			const l = latest[i] || 0;
			if (l > c) return true;
			if (l < c) return false;
		}

		return false;
	}

	/**
	 * Create update badge element
	 */
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

			setTimeout(() => {
				setting.openTabById("community-plugins");
			}, 100);
		});

		return badge;
	}
}
