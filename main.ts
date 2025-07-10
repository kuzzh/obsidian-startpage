import { Plugin, WorkspaceLeaf } from "obsidian";
import { StartPageView, VIEW_TYPE_START_PAGE } from "./startpageview";
import { StartPageSettingTab, StartPageSettings, DEFAULT_SETTINGS } from "./settings";
import { setLocale } from "./i18n";

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

	onunload() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE).forEach((leaf) => leaf.detach());
	}
}
