import { Plugin, WorkspaceLeaf } from "obsidian";
import { StartPageView, VIEW_TYPE_START_PAGE } from "./view";
import { StartPageSettingTab, StartPageSettings, DEFAULT_SETTINGS } from "./settings";
import { setLocale } from "./i18n";

export default class StartPagePlugin extends Plugin {
  settings: StartPageSettings;

  async onload() {
    const obsidianLang = this.settings?.language || "en";
    setLocale(obsidianLang);

    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_START_PAGE,
      (leaf) => new StartPageView(leaf, this.app, this)
    );

    // Add ribbon button
    this.addRibbonIcon('home', 'Open Start Page', () => {
      this.activateStartPage();
    });

    // Add settings tab
    this.addSettingTab(new StartPageSettingTab(this.app, this));

    // 等待 workspace 布局准备好后再激活 Start Page
    this.app.workspace.onLayoutReady(() => {
      this.activateStartPage();
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateStartPage() {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
    
    if (existingLeaves.length > 0) {
      // If Start Page already exists, activate it
      this.app.workspace.revealLeaf(existingLeaves[0]);
    } else {
      // If no Start Page exists, create a new one
      try {
        const leaf = this.app.workspace.getLeaf('tab');
        if (leaf) {
          await leaf.setViewState({
            type: VIEW_TYPE_START_PAGE,
            active: true,
          });
        } else {
          // Fallback: try to create in the active leaf
          const activeLeaf = this.app.workspace.activeLeaf;
          if (activeLeaf) {
            await activeLeaf.setViewState({
              type: VIEW_TYPE_START_PAGE,
              active: true,
            });
          }
        }
      } catch (error) {
        console.error('Failed to create Start Page leaf:', error);
      }
    }
  }

  onunload() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE).forEach((leaf) => leaf.detach());
  }
}
