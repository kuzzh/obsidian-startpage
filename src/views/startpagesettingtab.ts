import { App, PluginSettingTab, Setting, Platform, TextComponent, ToggleComponent } from "obsidian";
import StartPagePlugin from "@/main";
import { VIEW_TYPE_START_PAGE, StartPageView } from "@/views/startpageview";
import { t } from "@/i18n";
import NoteSuggestModal from "@/views/notesuggestmodal";

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

	private async moveNote(fromIndex: number, toIndex: number) {
		const notes = [...this.plugin.settings.pinnedNotes];
		const [movedNote] = notes.splice(fromIndex, 1);
		notes.splice(toIndex, 0, movedNote);

		this.plugin.settings.pinnedNotes = notes;
		await this.plugin.saveSettings();
		this.refreshStartPage();
		this.display();
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
        this.createNewTabSettings(containerEl);
        this.createFooterSettings(containerEl);
        this.createPinnedNotesSettings(containerEl);

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
        new Setting(containerEl)
            .setName(t("pinned_notes_settings_heading"))
            .setHeading();
        new Setting(containerEl)
			.setName(t("pinned_notes_select"))
			.setDesc(t("pinned_notes_select_desc"))
			.addButton((button) => {
				button.setButtonText(t("pinned_notes_select_button")).onClick(() => {
					new NoteSuggestModal(this.app, async (file) => {
						if (!this.plugin.settings.pinnedNotes.includes(file.path)) {
							this.plugin.settings.pinnedNotes.push(file.path);
							await this.plugin.saveSettings();
							this.refreshStartPage();
							this.display();
						}
					}).open();
				});
			});

		// Display current pinned notes
		if (this.plugin.settings.pinnedNotes.length > 0) {
			new Setting(containerEl)
				.setName(t("current_pinned_notes"))
				.setHeading();

			const pinnedList = containerEl.createEl("ul", {
				cls: "pinned-note-list",
			});

			this.plugin.settings.pinnedNotes.forEach((path, index) => {
				const li = pinnedList.createEl("li", { cls: "pinned-note-item" });
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file) {
					li.createEl("span", { text: file.path });

					const buttonDiv = li.createEl("div", { cls: "control-buttons" });
					// Move up button
					if (index > 0) {
						buttonDiv.createEl("button", {
							text: t("move_up"),
							cls: "control-button"
						}).onclick = async () => {
							await this.moveNote(index, index - 1);
						};
					}

					// Move down button
					if (index < this.plugin.settings.pinnedNotes.length - 1) {
						buttonDiv.createEl("button", {
							text: t("move_down"),
							cls: "control-button"
						}).onclick = async () => {
							await this.moveNote(index, index + 1);
						};
					}

					// Remove button
					buttonDiv.createEl("button", {
						text: t("pinned_notes_remove"),
						cls: "mod-warning remove-button",
					}).onclick = async () => {
						this.plugin.settings.pinnedNotes = this.plugin.settings.pinnedNotes.filter((p) => p !== path);
						await this.plugin.saveSettings();
						this.refreshStartPage();
						this.display();
					};
				}
			});
		}
    }
}
