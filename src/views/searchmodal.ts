import { MyUtil } from "@/utils/myutil";
import SvgUtil from "@/utils/svgutil";
import { t } from "@/i18n";
import { App, Modal, prepareFuzzySearch, SearchComponent, TFile } from "obsidian";
import StartPagePlugin from "@/main";
import { NewNoteUtil } from "@/utils/newnoteutil";
import { StartPageView, VIEW_TYPE_START_PAGE } from "@/views/startpageview";

interface ParsedQuery {
	tags: string[];
	folders: string[];
	text: string;
}

interface SearchResult {
	file: TFile;
	// 命中偏移按显示文本（basename / 别名原文）计，用于渲染高亮
	nameOffsets: [number, number][];
	alias: string | null;
	aliasOffsets: [number, number][];
}

export default class SearchModal extends Modal {
	private searchComponent: SearchComponent;
	private allFiles: TFile[];
	private filteredResults: SearchResult[];
	private resultsContainer: HTMLElement;
	private onChooseItem: (item: TFile, forceTab: boolean) => void;
	private initialQuery: string = "";
	private selectedIndex: number = -1;
	private caseSensitive: boolean = false;
	private plugin: StartPagePlugin;

	constructor(app: App, plugin: StartPagePlugin, onChoose: (item: TFile, forceTab: boolean) => void, initialQuery: string = "") {
		super(app);
		this.plugin = plugin;
		this.setTitle(t("search_modal_title"));
		this.allFiles = this.app.vault.getFiles();
		this.filteredResults = [];
		this.onChooseItem = onChoose;
		this.initialQuery = initialQuery;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		contentEl.addClass("my-search-content");
		modalEl.addClass("my-search-modal");

		const searchContainer = contentEl.createDiv("search-container");

		this.searchComponent = new SearchComponent(searchContainer);
		this.searchComponent.setPlaceholder(t("search_placeholder")).onChange((value: string) => {
			this.performSearch(value);
		});

		const excludeSettingsBtn = searchContainer.createEl("button", {
			cls: "search-exclude-settings-btn",
			attr: {
				"title": this.getExcludeTooltip()
			}
		});
		const filterIcon = SvgUtil.createFilterIcon();
		excludeSettingsBtn.appendChild(filterIcon);

		excludeSettingsBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.openExcludeSettings();
		});

		const caseSensitiveBtn = searchContainer.createEl("button", {
			cls: "search-case-sensitive-btn",
			attr: {
				"title": t("case_sensitive")
			}
		});
		caseSensitiveBtn.setText("Aa");

		this.updateCaseSensitiveButton(caseSensitiveBtn);

		caseSensitiveBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.caseSensitive = !this.caseSensitive;
			this.updateCaseSensitiveButton(caseSensitiveBtn);
			const currentQuery = this.searchComponent.getValue();
			if (currentQuery) {
				this.performSearch(currentQuery);
			}
		});

		// 语法提示：过滤令牌与修饰键行为不可自主发现，以弱化小字列在结果区上方
		const hintsEl = contentEl.createDiv("search-syntax-hints");
		const hints: [string, string][] = [
			["#tag", t("search_hint_tag")],
			["folder:path", t("search_hint_folder")],
			["Ctrl+Enter", t("search_hint_new_tab")],
		];
		hints.forEach(([token, label], index) => {
			if (index > 0) {
				hintsEl.appendText("  ·  ");
			}
			hintsEl.createEl("code", { text: token });
			hintsEl.appendText(` ${label}`);
		});

		this.resultsContainer = contentEl.createDiv("search-results-container");

		if (this.initialQuery) {
			this.searchComponent.setValue(this.initialQuery);
			this.performSearch(this.initialQuery);
		}

		this.searchComponent.inputEl.focus();
		this.setupKeyboardNavigation();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// Obsidian 的 Modal 会把键盘作用域的 tabFocusContainerEl 指向弹窗容器且不清理，
		// 导致关闭后对主页容器的任何聚焦都被核心 blur 掉，任意键搜索失效
		(this.scope as unknown as { setTabFocusContainerEl: (el: Element | null) => void }).setTabFocusContainerEl(null);
		const view = this.app.workspace.getActiveViewOfType(StartPageView);
		if (view) {
			view.focusContainer();
		}
	}

	updateCaseSensitiveButton(button: HTMLElement) {
		if (this.caseSensitive) {
			button.addClass("is-active");
		} else {
			button.removeClass("is-active");
		}
	}

	// 查询中的 #tag 与 folder: 前缀作为过滤令牌剥离（位置任意、可多个、AND 组合），其余文本参与模糊匹配
	private parseQuery(query: string): ParsedQuery {
		const parsed: ParsedQuery = { tags: [], folders: [], text: "" };
		const words: string[] = [];
		for (const token of query.split(/\s+/)) {
			if (!token) {
				continue;
			}
			if (token.startsWith("#") && token.length > 1) {
				parsed.tags.push(token.slice(1).toLowerCase());
			} else if (token.toLowerCase().startsWith("folder:") && token.length > 7) {
				parsed.folders.push(token.slice(7).toLowerCase());
			} else {
				words.push(token);
			}
		}
		parsed.text = words.join(" ");
		return parsed;
	}

	// frontmatter tags + 正文行内 #tag，子标签按段前缀命中（a 匹配 a/b 但不匹配 ab）
	private getFileTags(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		const tags = new Set<string>();
		const fm = cache?.frontmatter?.tags ?? cache?.frontmatter?.tag;
		const list = Array.isArray(fm) ? fm : fm ? [fm] : [];
		for (const tag of list) {
			if (typeof tag === "string") {
				tags.add(tag.replace(/^#/, "").toLowerCase());
			}
		}
		for (const tag of cache?.tags ?? []) {
			tags.add(tag.tag.replace(/^#/, "").toLowerCase());
		}
		return [...tags];
	}

	private passesFilters(file: TFile, parsed: ParsedQuery): boolean {
		for (const tag of parsed.tags) {
			if (!this.getFileTags(file).some((candidate) => candidate === tag || candidate.startsWith(tag + "/"))) {
				return false;
			}
		}
		for (const folder of parsed.folders) {
			if (!file.path.toLowerCase().startsWith(folder + "/")) {
				return false;
			}
		}
		return true;
	}

	// 统一两种匹配的产物为偏移对，供高亮渲染；offsets 兼容嵌套数组与扁平数组两种形态
	private toOffsetPairs(offsets: unknown): [number, number][] {
		if (!Array.isArray(offsets) || offsets.length === 0) {
			return [];
		}
		if (Array.isArray(offsets[0])) {
			return offsets as [number, number][];
		}
		const pairs: [number, number][] = [];
		for (let i = 0; i + 1 < offsets.length; i += 2) {
			pairs.push([offsets[i] as number, offsets[i + 1] as number]);
		}
		return pairs;
	}

	private substringOffsets(text: string, query: string): [number, number][] {
		const start = text.indexOf(query);
		return start === -1 ? [] : [[start, start + query.length]];
	}

	performSearch(query: string) {
		const parsed = this.parseQuery(query);
		this.filteredResults = [];

		if (query !== "") {
			const candidates = this.allFiles.filter((file) => {
				if (MyUtil.isFileExcluded(this.plugin.settings, file)) {
					return false;
				}
				return this.passesFilters(file, parsed);
			});

			if (parsed.text === "") {
				// 纯过滤令牌：无文本匹配，按修改时间倒序展示
				this.filteredResults = candidates
					.sort((a, b) => b.stat.mtime - a.stat.mtime)
					.map((file) => ({ file, nameOffsets: [], alias: null, aliasOffsets: [] }));
			} else if (this.caseSensitive) {
				// 区分大小写保持原有子串语义
				for (const file of candidates) {
					const nameOffsets = this.substringOffsets(file.basename, parsed.text);
					if (nameOffsets.length > 0) {
						this.filteredResults.push({ file, nameOffsets, alias: null, aliasOffsets: [] });
						continue;
					}
					for (const alias of this.getAliases(file)) {
						const aliasOffsets = this.substringOffsets(alias, parsed.text);
						if (aliasOffsets.length > 0) {
							this.filteredResults.push({ file, nameOffsets: [], alias, aliasOffsets });
							break;
						}
					}
				}
			} else {
				// 模糊匹配 + 按相关度排序，对齐核心 Quick Switcher 体验
				// 匹配目标改为 basename，使偏移与显示文本直接对齐（原为含扩展名的 file.name）
				const fuzzy = prepareFuzzySearch(parsed.text);
				const scored: { result: SearchResult; score: number }[] = [];
				for (const file of candidates) {
					const nameMatch = fuzzy(file.basename);
					if (nameMatch) {
						scored.push({
							score: nameMatch.score,
							result: { file, nameOffsets: this.toOffsetPairs(nameMatch.matches), alias: null, aliasOffsets: [] },
						});
						continue;
					}
					for (const alias of this.getAliases(file)) {
						const aliasMatch = fuzzy(alias);
						if (aliasMatch) {
							scored.push({
								score: aliasMatch.score,
								result: { file, nameOffsets: [], alias, aliasOffsets: this.toOffsetPairs(aliasMatch.matches) },
							});
							break;
						}
					}
				}
				scored.sort((a, b) => b.score - a.score);
				this.filteredResults = scored.map((s) => s.result);
			}
		}

		this.renderResults(parsed);
	}

	private getAliases(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		const aliases = cache?.frontmatter?.aliases || cache?.frontmatter?.alias;
		if (!aliases) {
			return [];
		}
		return (Array.isArray(aliases) ? aliases : [aliases]).filter((a): a is string => typeof a === "string");
	}

	// offsets 不重叠且升序（prepareFuzzySearch 保证），命中片段包高亮 span
	private appendHighlightedText(container: HTMLElement, text: string, offsets: [number, number][]): void {
		if (offsets.length === 0) {
			container.setText(text);
			return;
		}
		let cursor = 0;
		for (const [start, end] of offsets) {
			if (start > cursor) {
				container.appendText(text.slice(cursor, start));
			}
			container.createEl("span", { cls: "search-result-item-highlight", text: text.slice(start, end) });
			cursor = end;
		}
		if (cursor < text.length) {
			container.appendText(text.slice(cursor));
		}
	}

	renderResults(parsed: ParsedQuery) {
		this.resultsContainer.empty();
		this.selectedIndex = -1;

		if (this.filteredResults.length === 0) {
			const emptyEl = this.resultsContainer.createDiv("search-empty-state");
			const query = parsed.text;
			if (query) {
				const [beforeEnter, rest] = t("no_results_press_enter").split("{enter}");
				const [beforeQuery, afterQuery] = rest.split("{query}");
				emptyEl.appendText(beforeEnter);
				emptyEl.createEl("b", { text: t("enter_key") });
				emptyEl.appendText(beforeQuery);
				emptyEl.createEl("b", { text: query });
				emptyEl.appendText(afterQuery);
			} else {
				emptyEl.setText(t("no_results"));
			}
			return;
		}

		const listEl = this.resultsContainer.createEl("ul", { cls: "search-results-list" });
		for (let i = 0; i < this.filteredResults.length; i++) {
			const result = this.filteredResults[i];
			const file = result.file;
			const itemEl = listEl.createEl("li", { cls: "search-result-item" });

			const fileNameEl = document.createElement("span");
			fileNameEl.addClass("search-result-item-file-name");
			this.appendHighlightedText(fileNameEl, file.basename, result.nameOffsets);
			itemEl.setAttribute("title", file.basename);
			itemEl.appendChild(fileNameEl);

			const extEl = document.createElement("span");
			extEl.addClass("search-result-item-ext");
			itemEl.appendChild(extEl);
			extEl.setText(file.extension.toUpperCase());

			if (result.alias) {
				const aliasEl = document.createElement("span");
				aliasEl.addClass("search-result-item-alias");
				this.appendHighlightedText(aliasEl, result.alias, result.aliasOffsets);
				itemEl.appendChild(aliasEl);
			}

			if (file.parent && !file.parent.isRoot()) {
				const folderName = file.parent.name;
				const folderNameEl = document.createElement("span");
				const folderIconEl = SvgUtil.createFolderIcon();

				folderNameEl.setText(folderName);

				folderNameEl.addClass("search-result-item-folder-name");
				folderIconEl.addClass("search-result-item-folder-icon");

				itemEl.appendChild(folderIconEl);
				itemEl.appendChild(folderNameEl);
			}

			itemEl.onClickEvent(() => {
				this.onChooseItem(file, false);
				this.close();
			});

			itemEl.addEventListener("mouseenter", (event) => {
				this.app.workspace.trigger("hover-link", {
					event: event,
					source: VIEW_TYPE_START_PAGE,
					hoverParent: itemEl,
					targetEl: itemEl,
					linktext: file.path,
					sourcePath: "",
				});
			});
		}

		if (this.filteredResults.length > 0) {
			this.setActiveIndex(0);
		}
	}

	setupKeyboardNavigation() {
		this.searchComponent.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();

				if (this.filteredResults.length === 0) {
					// 过滤令牌不进入新建笔记标题，只用纯文本部分
					const text = this.parseQuery(this.searchComponent.getValue()).text.trim();
					if (text) {
						this.createNewNote(text);
					}
				} else if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredResults.length) {
					// Ctrl/Cmd+Enter 强制新标签打开，不受"新标签打开"设置影响
					const forceTab = e.ctrlKey || e.metaKey;
					const selected = this.filteredResults[this.selectedIndex];
					this.onChooseItem(selected.file, forceTab);
					this.close();
				}
				return;
			}

			if (this.filteredResults.length === 0) return;

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				this.setActiveIndex((this.selectedIndex + 1) % this.filteredResults.length);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				const newIndex = this.selectedIndex - 1;
				this.setActiveIndex(newIndex < 0 ? this.filteredResults.length - 1 : newIndex);
			}
		});
	}

	setActiveIndex(index: number) {
		const items = this.resultsContainer.querySelectorAll('.search-result-item');

		items.forEach(item => item.removeClass('is-active'));

		if (index >= 0 && index < items.length) {
			this.selectedIndex = index;
			items[index].addClass('is-active');

			items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}

	async createNewNote(noteName: string) {
		try {
			// 复用新建笔记工具，尊重标题模板/目标目录/重名策略设置，与主页新建按钮行为一致
			const file = await NewNoteUtil.createNote(this.app, this.plugin, noteName);
			if (!file) {
				return;
			}
			await this.app.workspace.getLeaf().openFile(file);
			this.close();
		} catch (error) {
			console.error('Failed to create new note:', error);
		}
	}

	private getExcludeTooltip(): string {
		const excludeList = this.plugin.settings.searchExcludePaths;
		const excludeExtensions = this.plugin.settings.searchExcludeExtensions;

		if (excludeList.length === 0 && excludeExtensions.length === 0) {
			return t("search_exclude_settings_tooltip").replace("{list}", t("no_results"));
		}

		const items: string[] = [];

		if (excludeList.length > 0) {
			const displayList = excludeList.length <= 2
				? excludeList.join(", ")
				: excludeList.slice(0, 2).join(", ") + "...";
			items.push(displayList);
		}

		if (excludeExtensions.length > 0) {
			const extDisplay = excludeExtensions.length <= 2
				? excludeExtensions.map(ext => `.${ext}`).join(", ")
				: excludeExtensions.slice(0, 2).map(ext => `.${ext}`).join(", ") + "...";
			items.push(extDisplay);
		}

		return t("search_exclude_settings_tooltip").replace("{list}", items.join(" | "));
	}

	private openExcludeSettings() {
		this.close();
		(this.app as any).setting.open();
		(this.app as any).setting.openTabById(this.plugin.manifest.id);
	}
}
