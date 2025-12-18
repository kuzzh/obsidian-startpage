import { MyUtil } from "@/utils/myutil";
import SvgUtil from "@/utils/svgutil";
import { t } from "@/i18n";
import { App, Modal, SearchComponent, Setting, TFile } from "obsidian";

export default class SearchModal extends Modal {
	private searchComponent: SearchComponent;
	private allFiles: TFile[];
	private filteredResults: TFile[];
	private resultsContainer: HTMLElement;
	private onChooseItem: (item: TFile) => void;
	private initialQuery: string = "";
	private selectedIndex: number = -1;
	private caseSensitive: boolean = false;

	constructor(app: App, onChoose: (item: TFile) => void, initialQuery: string = "") {
		super(app);
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


		// Case sensitivity toggle button
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
	}

	updateCaseSensitiveButton(button: HTMLElement) {
		if (this.caseSensitive) {
			button.addClass("is-active");
		} else {
			button.removeClass("is-active");
		}
	}

	performSearch(query: string) {
		if (query === "") {
			this.filteredResults = [];
		} else {
			if (this.caseSensitive) {
				this.filteredResults = this.allFiles.filter((file) => {
					// Search in file name
					if (file.name.includes(query)) {
						return true;
					}
					
					// Search in aliases
					const cache = this.app.metadataCache.getFileCache(file);
					const aliases = cache?.frontmatter?.aliases || cache?.frontmatter?.alias;
					if (aliases) {
						const aliasArray = Array.isArray(aliases) ? aliases : [aliases];
						return aliasArray.some((alias: string) => 
							typeof alias === 'string' && alias.includes(query)
						);
					}
					
					return false;
				});
			} else {
				const lowerCaseQuery = query.toLowerCase();
				this.filteredResults = this.allFiles.filter((file) => {
					// Search in file name
					if (file.name.toLowerCase().includes(lowerCaseQuery)) {
						return true;
					}
					
					// Search in aliases
					const cache = this.app.metadataCache.getFileCache(file);
					const aliases = cache?.frontmatter?.aliases || cache?.frontmatter?.alias;
					if (aliases) {
						const aliasArray = Array.isArray(aliases) ? aliases : [aliases];
						return aliasArray.some((alias: string) => 
							typeof alias === 'string' && alias.toLowerCase().includes(lowerCaseQuery)
						);
					}
					
					return false;
				});
			}
		}

		this.renderResults();
	}

	renderResults() {
		this.resultsContainer.empty();
		this.selectedIndex = -1;

		if (this.filteredResults.length === 0) {
			const emptyEl = this.resultsContainer.createDiv("search-empty-state");
			const query = this.searchComponent.getValue();
			if (query) {
				emptyEl.innerHTML = t("no_results_press_enter").replace("{query}", query);
			} else {
				emptyEl.setText(t("no_results"));
			}
			return;
		}

		const listEl = this.resultsContainer.createEl("ul", { cls: "search-results-list" });
		for (let i = 0; i < this.filteredResults.length; i++) {
			const file = this.filteredResults[i];
			const itemEl = listEl.createEl("li", { cls: "search-result-item" });
			const fileNameWithoutExt = MyUtil.getFileNameWithoutExtension(file.name);

			const fileNameEl = document.createElement("span");
			fileNameEl.addClass("search-result-item-file-name");
			fileNameEl.setText(fileNameWithoutExt);
			itemEl.setAttribute("title", fileNameWithoutExt);
			itemEl.appendChild(fileNameEl);

			// Check if file has matching aliases
			const query = this.searchComponent.getValue();
			const cache = this.app.metadataCache.getFileCache(file);
			const aliases = cache?.frontmatter?.aliases || cache?.frontmatter?.alias;
			const matchedAlias = this.getMatchedAlias(aliases, query);
			
			if (matchedAlias) {
				const aliasEl = document.createElement("span");
				aliasEl.addClass("search-result-item-alias");
				aliasEl.setText(matchedAlias);
				itemEl.appendChild(aliasEl);
			}

			const tagEl = document.createElement("span");
			tagEl.addClass("search-result-item-tag");
			itemEl.appendChild(tagEl);

			if (file.extension.toLowerCase() === "canvas" ||
				file.extension.toLowerCase() === "base") {
				tagEl.setText(file.extension.toUpperCase());
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
				this.onChooseItem(file);
				this.close();
			});
		}

		// Set first item as active by default
		if (this.filteredResults.length > 0) {
			this.setActiveIndex(0);
		}
	}

	setupKeyboardNavigation() {
		this.searchComponent.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();

				if (this.filteredResults.length === 0) {
					// Create a new note when no results
					const query = this.searchComponent.getValue().trim();
					if (query) {
						this.createNewNote(query);
					}
				} else if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredResults.length) {
					const selectedFile = this.filteredResults[this.selectedIndex];
					this.onChooseItem(selectedFile);
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

		// Remove active class from all items
		items.forEach(item => item.removeClass('is-active'));

		// Add active class to selected item
		if (index >= 0 && index < items.length) {
			this.selectedIndex = index;
			items[index].addClass('is-active');

			// Scroll item into view if needed
			items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}

	async createNewNote(noteName: string) {
		try {
			// Sanitize the filename to remove invalid characters
			const sanitizedName = noteName.replace(/[\\/:*?"<>|]/g, '');
			const fileName = `${sanitizedName}.md`;

			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(fileName);
			if (existingFile) {
				// If file exists, just open it
				if (existingFile instanceof TFile) {
					await this.app.workspace.getLeaf().openFile(existingFile);
				}
			} else {
				const newFile = await this.app.vault.create(fileName, '');
				await this.app.workspace.getLeaf().openFile(newFile);
			}

			this.close();
		} catch (error) {
			console.error('Failed to create new note:', error);
		}
	}

	private getMatchedAlias(aliases: string | string[] | undefined, query: string): string | null {
		if (!aliases || !query) return null;
		
		const aliasArray = Array.isArray(aliases) ? aliases : [aliases];
		const searchQuery = this.caseSensitive ? query : query.toLowerCase();
		
		for (const alias of aliasArray) {
			if (typeof alias !== 'string') continue;
			
			const aliasToCheck = this.caseSensitive ? alias : alias.toLowerCase();
			if (aliasToCheck.includes(searchQuery)) {
				return alias;
			}
		}
		
		return null;
	}
}
