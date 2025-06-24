import { App, PluginSettingTab, Setting, TFile, Modal } from "obsidian";
import StartPagePlugin from "./main";
import { VIEW_TYPE_START_PAGE, StartPageView } from "./startpageview";
import { setLocale, t } from "./i18n";
import NoteSuggestModal from "./notesuggestmodal";

export interface StartPageSettings {
	language: string;
	recentNotesLimit: number;
	pinnedNotes: string[];
}

export const DEFAULT_SETTINGS: StartPageSettings = {
	language: "en",
	recentNotesLimit: 5,
	pinnedNotes: [],
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

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t("language"))
			.setDesc(t("language_desc"))
			.addDropdown((dropdown) => {
				dropdown.addOption("en", t("language_en"));
				dropdown.addOption("zh", t("language_zh"));
				dropdown.setValue(this.plugin.settings.language);
				dropdown.onChange(async (value) => {
					this.plugin.settings.language = value;
					setLocale(value);
					await this.plugin.saveSettings();

					// Reload setting page and start page
					this.display();
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
		// .addButton(button => button
		//     .setButtonText(t("pinned_notes_select"))
		//     .onClick(() => {
		//         const files = this.app.vault.getMarkdownFiles();
		//         new NoteTreeModal(this.app, files, async (file) => {
		//             if (!this.plugin.settings.pinnedNotes.includes(file.path)) {
		//                 this.plugin.settings.pinnedNotes.push(file.path);
		//                 await this.plugin.saveSettings();
		//                 this.refreshStartPage();
		//                 this.display();
		//             }
		//         }).open();
		//     }));

		// 显示当前置顶笔记
		if (this.plugin.settings.pinnedNotes.length > 0) {
			containerEl.createEl("h3", { text: t("current_pinned_notes") });
			const pinnedList = containerEl.createEl("ul", {
				cls: "pinned-note-list",
			});

			for (const path of this.plugin.settings.pinnedNotes) {
				const li = pinnedList.createEl("li", { cls: "pinned-note-item" });
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file) {
					li.createEl("span", { text: file.path });
					li.createEl("button", {
						text: t("pinned_notes_remove"),
						cls: "mod-warning remove-button",
					}).onclick = async () => {
						this.plugin.settings.pinnedNotes = this.plugin.settings.pinnedNotes.filter((p) => p !== path);
						await this.plugin.saveSettings();
						this.refreshStartPage();
						this.display();
					};
				}
			}
		}
	}
}
