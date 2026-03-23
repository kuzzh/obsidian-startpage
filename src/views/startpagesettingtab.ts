import { App, PluginSettingTab, Setting, Platform, TextComponent, ToggleComponent, Notice, TFolder, ButtonComponent } from "obsidian";
import StartPagePlugin from "@/main";
import { VIEW_TYPE_START_PAGE, StartPageView } from "@/views/startpageview";
import { t } from "@/i18n";
import StyleSettingsModal from "@/views/stylesettingsmodal";
import SearchExclusionModal from "@/views/searchexclusionmodal";
import PinnedNotesModal from "@/views/pinnednotesmodal";

export class StartPageSettingTab extends PluginSettingTab {
	plugin: StartPagePlugin;
	useRandomFooterTextComponent: ToggleComponent;
	customFooterTextComponent: TextComponent;

	constructor(app: App, plugin: StartPagePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private refreshStartPage() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
		leaves.forEach((leaf) => {
			if (leaf.view instanceof StartPageView) {
				leaf.view.renderContent();
			}
		});
	}

	private updateTitleNavigationBar() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
		leaves.forEach((leaf) => {
			if (leaf.view instanceof StartPageView) {
				const view = leaf.view as StartPageView;
				if (this.plugin.settings.showTitleNavigationBar === "show") {
					view.showTitleNavigationBar(true);
				} else if (this.plugin.settings.showTitleNavigationBar === "hide") {
					view.showTitleNavigationBar(false);
				} else { // default
					view.showTitleNavigationBar(!Platform.isDesktop);
				}
			}
		});
	}

	updateFootComponentDisabledState() {
		if (this.customFooterTextComponent) {
			this.customFooterTextComponent.setDisabled(!this.plugin.settings.showCustomFooterText || this.plugin.settings.useRandomFooterText);
		}
		if (this.useRandomFooterTextComponent) {
			this.useRandomFooterTextComponent.setDisabled(!this.plugin.settings.showCustomFooterText);
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

        this.createGeneralSettings(containerEl);
        this.createAppearanceSettings(containerEl);
        this.createStyleSettings(containerEl);
        this.createNewTabSettings(containerEl);
        this.createSearchSettings(containerEl);
        this.createPinnedNotesSettings(containerEl);
        this.createFooterSettings(containerEl);

		setTimeout(() => {
			this.updateFootComponentDisabledState();
		}, 0);
	}

    private createGeneralSettings(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName(t("general_settings_heading"))
            .setHeading();
        new Setting(containerEl)
			.setName(t("include_all_files_in_recent"))
			.setDesc(t("include_all_files_in_recent_desc"))
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.includeAllFilesInRecent);
				toggle.onChange(async (value) => {
					this.plugin.settings.includeAllFilesInRecent = value;
					await this.plugin.saveSettings();
					this.refreshStartPage();
				});
			});

		new Setting(containerEl)
			.setName(t("recent_notes_limit"))
			.setDesc(t("recent_notes_limit_desc"))
			.addDropdown((dropdown) => {
				for (let i = 5; i <= 50; i += 5) {
					dropdown.addOption(i.toString(), i.toString());
				}
				dropdown.setValue(this.plugin.settings.recentNotesLimit.toString());
				dropdown.onChange(async (value) => {
					this.plugin.settings.recentNotesLimit = parseInt(value);
					await this.plugin.saveSettings();
					this.refreshStartPage();
				});
			});
    }

    private createAppearanceSettings(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName(t("appearance_settings_heading"))
            .setHeading();
        new Setting(containerEl)
			.setName(t("show_title_navigation_bar"))
			.setDesc(t("show_title_navigation_bar_desc"))
			.addDropdown((dropdown) => {
				dropdown.addOption("default", t("show_title_navigation_bar_default"));
				dropdown.addOption("show", t("show_title_navigation_bar_show"));
				dropdown.addOption("hide", t("show_title_navigation_bar_hide"));
				dropdown.setValue(this.plugin.settings.showTitleNavigationBar);
				dropdown.onChange(async (value: "default" | "show" | "hide") => {
					this.plugin.settings.showTitleNavigationBar = value;
					await this.plugin.saveSettings();
					this.updateTitleNavigationBar();
				});
			});
		new Setting(containerEl)
			.setName(t("show_stat_bar"))
			.setDesc(t("show_stat_bar_desc"))
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showStatBar);
				toggle.onChange(async (value) => {
					this.plugin.settings.showStatBar = value;
					await this.plugin.saveSettings();
					this.refreshStartPage();
				});
			});
    }

    private createStyleSettings(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName(t("style_settings_heading"))
            .setDesc(t("style_settings_desc"))
            .addButton(button => {
                button
                    .setButtonText(t("style_settings_open_button"))
                    .onClick(() => {
                        new StyleSettingsModal(this.app, this.plugin, () => {
                            this.refreshStartPage();
                        }).open();
                    });
            });
    }

    private createNewTabSettings(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName(t("new_tab_settings_heading"))
            .setHeading();
        new Setting(containerEl)
			.setName(t("replace_new_tab"))
			.setDesc(t("replace_new_tab_desc"))
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.replaceNewTab);
				toggle.onChange(async (value) => {
					this.plugin.settings.replaceNewTab = value;
					await this.plugin.saveSettings();
				});
			});
    }

    private createSearchSettings(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName(t("search_settings_heading"))
            .setHeading();

        const pathCount = this.plugin.settings.searchExcludePaths.length;
        const extCount = this.plugin.settings.searchExcludeExtensions.length;
        const totalCount = pathCount + extCount;

        new Setting(containerEl)
            .setName(t("search_exclusion_settings"))
            .setDesc(t("search_exclusion_settings_desc", totalCount.toString()))
            .addButton((button) => {
                button.setButtonText(t("search_exclusion_settings_button"))
                    .setCta()
                    .onClick(() => {
                        new SearchExclusionModal(this.app, this.plugin, () => {
                            this.display();
                        }).open();
                    });
            });
    }

    private createFooterSettings(containerEl: HTMLElement) {
        new Setting(containerEl)
			.setName(t("footer_settings_heading"))
			.setHeading();

		new Setting(containerEl)
			.setName(t("show_custom_footer_text"))
			.setDesc(t("show_custom_footer_text_desc"))
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showCustomFooterText);
				toggle.onChange(async (value) => {
					this.plugin.settings.showCustomFooterText = value;
					if (!value) {
						this.plugin.settings.useRandomFooterText = false;
						this.useRandomFooterTextComponent.setValue(false);
					}
					await this.plugin.saveSettings();
					this.updateFootComponentDisabledState();
					this.refreshStartPage();
				});
			});

		new Setting(containerEl)
			.setName(t("use_random_footer_text"))
			.setDesc(t("use_random_footer_text_desc"))
			.addToggle((toggle) => {
				this.useRandomFooterTextComponent = toggle;
				toggle.setValue(this.plugin.settings.useRandomFooterText);
				toggle.onChange(async (value) => {
					this.plugin.settings.useRandomFooterText = value;
					await this.plugin.saveSettings();
					this.updateFootComponentDisabledState();
					this.refreshStartPage();
				});
			});

		new Setting(containerEl)
			.setName(t("custom_footer_text"))
			.setDesc(t("custom_footer_text_desc"))
			.addText((text) => {
				this.customFooterTextComponent = text;
				text.setValue(this.plugin.settings.customFooterText);
				text.onChange(async (value) => {
					this.plugin.settings.customFooterText = value;
					await this.plugin.saveSettings();
					this.updateFootComponentDisabledState();
					this.refreshStartPage();
				});
			});
    }

    private createPinnedNotesSettings(containerEl: HTMLElement) {
        this.createPinnedNotesHeading(containerEl);
        this.createManagePinnedNotesButton(containerEl);
    }

    private createPinnedNotesHeading(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName(t("pinned_notes_settings_heading"))
            .setHeading();
    }

    private createManagePinnedNotesButton(containerEl: HTMLElement) {
        const pinnedCount = this.plugin.settings.pinnedNotes.length;

        new Setting(containerEl)
            .setName(t("pinned_notes_settings"))
            .setDesc(t("current_pinned_notes_desc", pinnedCount.toString()))
            .addButton((button) => {
                button
                    .setButtonText(t("manage_pinned_notes_button"))
                    .setCta()
                    .onClick(() => {
                        new PinnedNotesModal(this.app, this.plugin, () => {
                            this.refreshStartPage();
                            this.display();
                        }).open();
                    });
            });
    }
}