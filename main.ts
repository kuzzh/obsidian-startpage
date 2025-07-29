import { Plugin, WorkspaceLeaf, TFile, Menu } from "obsidian";
import { StartPageView, VIEW_TYPE_START_PAGE } from "./startpageview";
import { StartPageSettingTab, StartPageSettings, DEFAULT_SETTINGS } from "./settings";
import { setLocale, t } from "./i18n";

export default class StartPagePlugin extends Plugin {
	settings: StartPageSettings;

	async onload() {
		const obsidianLang = this.settings?.language || "en";
		setLocale(obsidianLang);

		await this.loadSettings();

		this.registerView(VIEW_TYPE_START_PAGE, (leaf) => new StartPageView(leaf, this.app, this));

		// Add ribbon button
		this.addRibbonIcon("home", "Open Start Page", () => {
			this.activateStartPage();
		});

		// Add settings tab
		this.addSettingTab(new StartPageSettingTab(this.app, this));

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
