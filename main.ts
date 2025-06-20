import { Plugin, WorkspaceLeaf, TFile } from "obsidian";
import { StartPageView, VIEW_TYPE_START_PAGE } from "./startpageview";
import { StartPageSettingTab, StartPageSettings, DEFAULT_SETTINGS } from "./settings";
import { setLocale } from "./i18n";

export default class StartPagePlugin extends Plugin {
	settings: StartPageSettings;
	private startPageLeaf: WorkspaceLeaf | null = null;

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

		// 等待 workspace 布局准备好后再激活 Start Page
		this.app.workspace.onLayoutReady(() => {
			// this.activateStartPage();
		});
		this.app.workspace.on("file-open", (file: TFile | null) => {
			console.log("file-open", file);
			if (!file) {
				return;
			}
			if (!this.startPageLeaf) {
				this.activateStartPage();
				this.app.workspace.openLinkText(file.path, "", false);
			} 
		}); 
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateStartPage() {
    if (!this.startPageLeaf) {
      const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
      if (existingLeaves.length > 0) {
        this.startPageLeaf = existingLeaves[0];
      }
    }
		if (this.startPageLeaf) {
			this.app.workspace.revealLeaf(this.startPageLeaf);
			return; 
		}
		try {
			const leaf = this.app.workspace.getLeaf(false);
			if (leaf) {
				leaf.setPinned(true);
				await leaf.setViewState({
					type: VIEW_TYPE_START_PAGE,
					active: true,
				});
        this.startPageLeaf = leaf;
			}
		} catch (error) {
			console.error("Failed to create Start Page leaf:", error);
		}
	}

	onunload() {
    this.startPageLeaf = null;
		this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE).forEach((leaf) => leaf.detach());
	}
}
