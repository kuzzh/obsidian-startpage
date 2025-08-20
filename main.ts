import { Plugin, WorkspaceLeaf, TFile, Menu, getLanguage } from "obsidian";
import { StartPageView, VIEW_TYPE_START_PAGE } from "./startpageview";
import { StartPageSettingTab, StartPageSettings, DEFAULT_SETTINGS } from "./settings";
import { setLocale, t } from "./i18n";
import "./types";

export default class StartPagePlugin extends Plugin {
	settings: StartPageSettings;

	async onload() {
		await this.loadSettings();
		
		// Use Obsidian's built-in language setting
		const obsidianLang = getLanguage() || "en";
		setLocale(obsidianLang);

		this.registerView(VIEW_TYPE_START_PAGE, (leaf) => new StartPageView(leaf, this.app, this));

		// Add ribbon button
		this.addRibbonIcon("home", "Open start page", () => {
			this.activateStartPage();
		});

		// Add settings tab
		this.addSettingTab(new StartPageSettingTab(this.app, this));

		// Add commands
		this.addCommand({
			id: "open-start-page",
			name: t("open_start_page"),
			callback: () => {
				this.activateStartPage();
			}
		});

		this.addCommand({
			id: "open-start-page-new-tab",
			name: t("open_start_page_new_tab"),
			callback: () => {
				this.activateStartPageNewTab();
			}
		});

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf: WorkspaceLeaf | null) => {
				if (this.settings.replaceNewTab) {
					if (leaf && !leaf.view.getViewType().startsWith(VIEW_TYPE_START_PAGE)) {
						const state = leaf.getViewState();
						// If new empty tab, replace it with StartPage
						if (state.type === 'empty' &&  !state.state?.file) {
							this.replaceWithStartPage(leaf);
						}
					}
				}
			})
		);

		// Register file menu event for right-click context menu
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
				if (file instanceof TFile) {
					this.addPinnedNoteMenuItem(menu, file);
				}
			})
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	findStartPageLeaf(): WorkspaceLeaf | null {
		const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
		if (existingLeaves.length > 0) {
			return existingLeaves[0];
		}
		return null;
	}

	async activateStartPage() {
		try {
			const leaf = this.app.workspace.getLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_START_PAGE,
					active: true,
				});
			}
		} catch (error) {
			console.error("Failed to create Start Page leaf:", error);
		}
	}

	async activateStartPageNewTab() {
		try {
			const leaf = this.app.workspace.getLeaf(true);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_START_PAGE,
					active: true,
				});
			}
		} catch (error) {
			console.error("Failed to create Start Page leaf in new tab:", error);
		}
	}

	async replaceWithStartPage(leaf: WorkspaceLeaf) {
		try {
			await leaf.setViewState({
				type: VIEW_TYPE_START_PAGE,
				active: true,
			});
		} catch (error) {
			console.error("Failed to replace with Start Page:", error);
		}
	}

	addPinnedNoteMenuItem(menu: Menu, file: TFile) {
		const isPinned = this.settings.pinnedNotes.includes(file.path);
		
		menu.addItem((item) => {
			item
				.setTitle(isPinned ? t("remove_from_pinned_notes") : t("add_to_pinned_notes"))
				.setIcon(isPinned ? "pin-off" : "pin")
				.onClick(async () => {
					if (isPinned) {
						// Remove from pinned notes
						this.settings.pinnedNotes = this.settings.pinnedNotes.filter(path => path !== file.path);
					} else {
						// Add to pinned notes
						this.settings.pinnedNotes.push(file.path);
					}
					await this.saveSettings();
					
					// Refresh start page if it's open
					const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
					leaves.forEach((leaf) => {
						if (leaf.view instanceof StartPageView) {
							leaf.view.renderContent();
						}
					});
				});
		});
	}

	onunload() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE).forEach((leaf) => leaf.detach());
	}
}
