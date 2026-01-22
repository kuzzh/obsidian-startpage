import { App, PluginSettingTab, Setting, Platform, TextComponent, ToggleComponent, Notice, TFolder } from "obsidian";
import StartPagePlugin from "@/main";
import { VIEW_TYPE_START_PAGE, StartPageView } from "@/views/startpageview";
import { t } from "@/i18n";
import NoteSuggestModal from "@/views/notesuggestmodal";
import FileFolderSuggestModal from "@/views/filefoldersuggestmodal";
import SvgUtil from "@/utils/svgutil";
import { MyUtil } from "@/utils/myutil";
import { SectionStyleSettings } from "@/types";

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

	private async importFromBookmarks() {
		try {
			// Access the bookmarks plugin via app.internalPlugins
			const bookmarksPlugin = (this.app as any).internalPlugins?.getPluginById('bookmarks');
			
			if (!bookmarksPlugin || !bookmarksPlugin.enabled) {
				new Notice(t("import_bookmarks_no_bookmarks"));
				return;
			}

			const bookmarks = bookmarksPlugin.instance?.items || [];
			
			// Filter file bookmarks and extract their paths
			const bookmarkedFilePaths: string[] = [];
			const extractFilePaths = (items: any[]) => {
				for (const item of items) {
					if (item.type === 'file' && item.path) {
						bookmarkedFilePaths.push(item.path);
					} else if (item.type === 'group' && item.items) {
						// Recursively process groups
						extractFilePaths(item.items);
					}
				}
			};
			
			extractFilePaths(bookmarks);

			if (bookmarkedFilePaths.length === 0) {
				new Notice(t("import_bookmarks_no_bookmarks"));
				return;
			}

			// Filter out already pinned notes
			const newPinnedNotes = bookmarkedFilePaths.filter(
				path => !this.plugin.settings.pinnedNotes.includes(path)
			);

			if (newPinnedNotes.length === 0) {
				new Notice(t("import_bookmarks_already_exist"));
				return;
			}

			// Add new bookmarked notes to pinned notes
			this.plugin.settings.pinnedNotes.push(...newPinnedNotes);
			await this.plugin.saveSettings();
			this.refreshStartPage();
			this.display();

			// Show success message
			const message = t("import_bookmarks_success").replace("{count}", newPinnedNotes.length.toString());
			new Notice(message);
		} catch (error) {
			console.error('Error importing bookmarks:', error);
			new Notice(t("import_bookmarks_no_bookmarks"));
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
            .setHeading();

        this.createSectionStyleSettings(containerEl, t("style_settings_pinned_notes"), this.plugin.settings.pinnedNotesStyle);
        this.createSectionStyleSettings(containerEl, t("style_settings_recent_notes"), this.plugin.settings.recentNotesStyle);
    }

    private createSectionStyleSettings(containerEl: HTMLElement, title: string, styleSettings: SectionStyleSettings) {
        const details = containerEl.createEl("details");
        const summary = details.createEl("summary");
        summary.textContent = title;
        summary.style.fontWeight = "bold";
        summary.style.cursor = "pointer";
        summary.style.marginBottom = "10px";

        this.addStyleSetting(details, styleSettings, "sectionMargin", t("style_section_margin"), t("style_section_margin_desc"));
        this.addStyleSetting(details, styleSettings, "sectionPadding", t("style_section_padding"), t("style_section_padding_desc"));

        this.addStyleSetting(details, styleSettings, "headerMargin", t("style_header_margin"), t("style_header_margin_desc"));
        this.addStyleSetting(details, styleSettings, "headerPadding", t("style_header_padding"), t("style_header_padding_desc"));

        this.addStyleSetting(details, styleSettings, "titleFontSize", t("style_title_font_size"), t("style_title_font_size_desc"));
        this.addStyleSetting(details, styleSettings, "titleMargin", t("style_title_margin"), t("style_title_margin_desc"));
        this.addStyleSetting(details, styleSettings, "titlePadding", t("style_title_padding"), t("style_title_padding_desc"));

        this.addStyleSetting(details, styleSettings, "listGap", t("style_list_gap"), t("style_list_gap_desc"));

        this.addStyleSetting(details, styleSettings, "itemPadding", t("style_item_padding"), t("style_item_padding_desc"));
        this.addStyleSetting(details, styleSettings, "itemMargin", t("style_item_margin"), t("style_item_margin_desc"));

        this.addStyleSetting(details, styleSettings, "noteTitleFontSize", t("style_note_title_font_size"), t("style_note_title_font_size_desc"));
        this.addStyleSetting(details, styleSettings, "noteTitleMargin", t("style_note_title_margin"), t("style_note_title_margin_desc"));
        this.addStyleSetting(details, styleSettings, "noteTitlePadding", t("style_note_title_padding"), t("style_note_title_padding_desc"));

        this.addStyleSetting(details, styleSettings, "noteDateFontSize", t("style_note_date_font_size"), t("style_note_date_font_size_desc"));

        this.addStyleSetting(details, styleSettings, "noteFolderFontSize", t("style_note_folder_font_size"), t("style_note_folder_font_size_desc"));
    }

    private addStyleSetting(container: HTMLElement, settings: SectionStyleSettings, key: keyof SectionStyleSettings, name: string, desc: string) {
        new Setting(container)
            .setName(name)
            .setDesc(desc)
            .addText(text => text
                .setValue(settings[key])
                .onChange(async (value) => {
                    settings[key] = value;
                    await this.plugin.saveSettings();
                    this.refreshStartPage();
                }));
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

        new Setting(containerEl)
            .setName(t("search_exclude_list"))
            .setDesc(t("search_exclude_list_desc"))
            .addButton((button) => {
                button.setButtonText(t("search_exclude_list_add_button")).onClick(() => {
                    new FileFolderSuggestModal(this.app, async (item) => {
                        if (!this.plugin.settings.excludeList.includes(item.path)) {
                            this.plugin.settings.excludeList.push(item.path);
                            await this.plugin.saveSettings();
                            this.display();
                        }
                    }).open();
                });
            });

        this.displayCurrentExcludeList(containerEl);
    }

    private displayCurrentExcludeList(containerEl: HTMLElement) {
        if (this.plugin.settings.excludeList.length === 0) {
            return;
        }

        new Setting(containerEl)
            .setName(t("current_search_exclude_list"))
            .setHeading();

        const excludeList = containerEl.createEl("ul", {
            cls: "pinned-note-list",
        });

        this.plugin.settings.excludeList.forEach((path, index) => {
            this.createExcludeListItem(excludeList, path, index);
        });
    }

    private createExcludeListItem(excludeList: HTMLElement, path: string, index: number) {
        const li = excludeList.createEl("li", { cls: "exclude-list-item" });
        const item = this.app.vault.getAbstractFileByPath(path);
        const isFolder = item instanceof TFolder;

        // Icon container
        const iconWrap = li.createSpan({ cls: "exclude-item-icon" });
        const icon = isFolder ? SvgUtil.createFolderIcon() : SvgUtil.createFileIcon("md");
        iconWrap.appendChild(icon);

        // Path container with ellipsis
        const pathContainer = li.createEl("div", { cls: "exclude-item-path" });
        const pathText = pathContainer.createEl("span", { cls: "exclude-item-path-text", text: path });
        pathText.setAttr("title", path);

        // Actions container
        const actionsEl = li.createEl("div", { cls: "exclude-item-actions" });
        this.createExcludeListRemoveButton(actionsEl, path);
    }

    private createExcludeListRemoveButton(container: HTMLElement, path: string) {
        const btn = container.createEl("button", { cls: "mod-warning remove-button control-button icon-button" });
        btn.setAttr("aria-label", t("search_exclude_list_remove"));
        btn.setAttr("title", t("search_exclude_list_remove"));
        const svg = SvgUtil.createRemoveIcon();
        btn.appendChild(svg);
        btn.onclick = async () => {
            this.plugin.settings.excludeList = this.plugin.settings.excludeList.filter((p) => p !== path);
            await this.plugin.saveSettings();
            this.display();
        };
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
        this.createNoteSelectionButton(containerEl);
        this.displayCurrentPinnedNotes(containerEl);
    }

    private createPinnedNotesHeading(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName(t("pinned_notes_settings_heading"))
            .setHeading();
    }

    private createNoteSelectionButton(containerEl: HTMLElement) {
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

        new Setting(containerEl)
            .setName(t("pinned_notes_import_from_bookmarks"))
            .setDesc(t("pinned_notes_import_from_bookmarks_desc"))
            .addButton((button) => {
                button.setButtonText(t("pinned_notes_import_from_bookmarks_button")).onClick(async () => {
                    await this.importFromBookmarks();
                });
            });
    }

    private displayCurrentPinnedNotes(containerEl: HTMLElement) {
        if (this.plugin.settings.pinnedNotes.length === 0) {
            return;
        }

        new Setting(containerEl)
            .setName(t("current_pinned_notes"))
            .setHeading();

        const pinnedList = containerEl.createEl("ul", {
            cls: "pinned-note-list",
        });

        this.plugin.settings.pinnedNotes.forEach((path, index) => {
            this.createPinnedNoteListItem(pinnedList, path, index);
        });
	}

    private createPinnedNoteListItem(pinnedList: HTMLElement, path: string, index: number) {
        const li = pinnedList.createEl("li", { cls: "pinned-note-item" });
        const file = this.app.vault.getAbstractFileByPath(path);

        if (!file) {
            return;
        }

        const filename = path.split("/").pop() ?? path;

        const line1 = li.createEl("div", { cls: "note-line1" });
        line1.createEl("span", { cls: "note-title", text: filename });

        const line2 = li.createEl("div", { cls: "note-line2" });
        const pathContainer = line2.createEl("div", { cls: "note-path" });
        const iconWrap = pathContainer.createSpan({ cls: "folder-icon" });
        const folderSvg = SvgUtil.createFolderIcon();
        iconWrap.appendChild(folderSvg);
        const dirPath = MyUtil.getDirPath(path);
        const pathText = pathContainer.createEl("span", { cls: "note-path-text", text: MyUtil.truncateMiddle(dirPath) });
        pathText.setAttr("title", dirPath);

        const actionsEl = line2.createEl("div", { cls: "note-actions" });
        this.createNoteControlButtons(actionsEl, path, index);
    }

    private createNoteControlButtons(container: HTMLElement, path: string, index: number) {
        this.createMoveUpButton(container, index);
        this.createMoveDownButton(container, index);
        this.createRemoveButton(container, path);
    }

    private createMoveUpButton(container: HTMLElement, index: number) {
        if (index > 0) {
            const btn = container.createEl("button", { cls: "control-button icon-button" });
            btn.setAttr("aria-label", t("move_up"));
            btn.setAttr("title", t("move_up"));
            const svg = SvgUtil.createArrowUpIcon();
            btn.appendChild(svg);
            btn.onclick = async () => {
                await this.moveNote(index, index - 1);
            };
        }
    }

    private createMoveDownButton(container: HTMLElement, index: number) {
        if (index < this.plugin.settings.pinnedNotes.length - 1) {
            const btn = container.createEl("button", { cls: "control-button icon-button" });
            btn.setAttr("aria-label", t("move_down"));
            btn.setAttr("title", t("move_down"));
            const svg = SvgUtil.createArrowDownIcon();
            btn.appendChild(svg);
            btn.onclick = async () => {
                await this.moveNote(index, index + 1);
            };
        }
    }

    private createRemoveButton(container: HTMLElement, path: string) {
        const btn = container.createEl("button", { cls: "mod-warning remove-button control-button icon-button" });
        btn.setAttr("aria-label", t("pinned_notes_remove"));
        btn.setAttr("title", t("pinned_notes_remove"));
        const svg = SvgUtil.createRemoveIcon();
        btn.appendChild(svg);
        btn.onclick = async () => {
            this.plugin.settings.pinnedNotes = this.plugin.settings.pinnedNotes.filter((p) => p !== path);
            await this.plugin.saveSettings();
            this.refreshStartPage();
            this.display();
        };
    }
}