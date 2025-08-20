import { App, PluginSettingTab, Setting } from "obsidian";
import StartPagePlugin from "./main";
import { VIEW_TYPE_START_PAGE, StartPageView } from "./startpageview";
import { t } from "./i18n";
import NoteSuggestModal from "./notesuggestmodal";

export interface StartPageSettings {
	recentNotesLimit: number;
	pinnedNotes: string[];
	replaceNewTab: boolean;
}

export const DEFAULT_SETTINGS: StartPageSettings = {
	recentNotesLimit: 10,
	pinnedNotes: [],
	replaceNewTab: true,
};

export class StartPageSettingTab extends PluginSettingTab {
	plugin: StartPagePlugin;

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

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

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

		new Setting(containerEl)
			.setName(t("pinned_notes_setting"))
			.setDesc(t("pinned_notes_select_desc"))
			.addButton((button) => {
				button.setButtonText(t("pinned_notes_select")).onClick(() => {
					new NoteSuggestModal(this.app, async (file) => {
						console.log(file);
						if (!this.plugin.settings.pinnedNotes.includes(file.path)) {
							this.plugin.settings.pinnedNotes.push(file.path);
							await this.plugin.saveSettings();
							this.refreshStartPage();
							this.display();
						}
					}).open();
				});
			});
		
		// Add settings option to replace new tab
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
