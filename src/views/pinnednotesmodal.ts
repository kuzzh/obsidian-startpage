import { App, Modal, Setting, Notice } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import SvgUtil from "@/utils/svgutil";
import { MyUtil } from "@/utils/myutil";

export default class PinnedNotesModal extends Modal {
	private plugin: StartPagePlugin;
	private onSettingsChange: () => void;

	constructor(app: App, plugin: StartPagePlugin, onSettingsChange: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSettingsChange = onSettingsChange;
		this.setTitle(t("current_pinned_notes"));
	}

	onOpen() {
		const { contentEl } = this;

		this.createAddNoteButton(contentEl);
		this.displayPinnedNotes(contentEl);
	}

	private createAddNoteButton(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName(t("pinned_notes_select"))
			.setDesc(t("pinned_notes_select_desc"))
			.addButton((button) => {
				button.setButtonText(t("pinned_notes_select_button")).onClick(() => {
					const NoteSuggestModal = require("@/views/notesuggestmodal").default;
					new NoteSuggestModal(this.app, async (file: any) => {
						if (!this.plugin.settings.pinnedNotes.includes(file.path)) {
							this.plugin.settings.pinnedNotes.push(file.path);
							await this.plugin.saveSettings();
							this.onSettingsChange();
							this.refreshDisplay();
						}
					}).open();
				});
			});

		new Setting(containerEl)
			.setName(t("pinned_notes_import_from_bookmarks"))
			.setDesc(t("pinned_notes_import_from_bookmarks_desc"))
			.addButton((button) => {
				button.setButtonText(t("pinned_notes_import_from_bookmarks_button")).onClick(async () => {
					await this.showImportConfirmDialog();
				});
			});
	}

	private async showImportConfirmDialog() {
		const modal = new Modal(this.app);
		modal.setTitle(t("confirm_import_title"));

		const { contentEl } = modal;
		contentEl.createEl("p", { text: t("confirm_import_desc") });

		new Setting(contentEl)
			.addButton((button) => {
				button
					.setButtonText(t("cancel"))
					.onClick(() => {
						modal.close();
					});
			})
			.addButton((button) => {
				button
					.setButtonText(t("confirm"))
					.setCta()
					.onClick(async () => {
						modal.close();
						await this.importFromBookmarks();
					});
			});

		modal.open();
	}

	private async importFromBookmarks() {
		try {
			const bookmarksPlugin = (this.app as any).internalPlugins?.getPluginById("bookmarks");

			if (!bookmarksPlugin || !bookmarksPlugin.enabled) {
				new Notice(t("import_bookmarks_no_bookmarks"));
				return;
			}

			const bookmarks = bookmarksPlugin.instance?.items || [];

			const bookmarkedFilePaths: string[] = [];
			const extractFilePaths = (items: any[]) => {
				for (const item of items) {
					if (item.type === "file" && item.path) {
						bookmarkedFilePaths.push(item.path);
					} else if (item.type === "group" && item.items) {
						extractFilePaths(item.items);
					}
				}
			};

			extractFilePaths(bookmarks);

			if (bookmarkedFilePaths.length === 0) {
				new Notice(t("import_bookmarks_no_bookmarks"));
				return;
			}

			const newPinnedNotes = bookmarkedFilePaths.filter((path) => !this.plugin.settings.pinnedNotes.includes(path));

			if (newPinnedNotes.length === 0) {
				new Notice(t("import_bookmarks_already_exist"));
				return;
			}

			this.plugin.settings.pinnedNotes.push(...newPinnedNotes);
			await this.plugin.saveSettings();
			this.onSettingsChange();
			this.refreshDisplay();

			const message = t("import_bookmarks_success").replace("{count}", newPinnedNotes.length.toString());
			new Notice(message);
		} catch (error) {
			console.error("Error importing bookmarks:", error);
			new Notice(t("import_bookmarks_no_bookmarks"));
		}
	}

	private displayPinnedNotes(containerEl: HTMLElement) {
		if (this.plugin.settings.pinnedNotes.length === 0) {
			containerEl.createEl("div", {
				cls: "pinned-notes-empty",
				text: t("no_pinned_notes"),
			});
			return;
		}

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
			this.onSettingsChange();
			this.refreshDisplay();
		};
	}

	private async moveNote(fromIndex: number, toIndex: number) {
		const notes = [...this.plugin.settings.pinnedNotes];
		const [movedNote] = notes.splice(fromIndex, 1);
		notes.splice(toIndex, 0, movedNote);

		this.plugin.settings.pinnedNotes = notes;
		await this.plugin.saveSettings();
		this.onSettingsChange();
		this.refreshDisplay();
	}

	private refreshDisplay() {
		const { contentEl } = this;
		// 保留标题，清空其他内容
		const modalContent = contentEl.querySelector(".modal-content");
		if (modalContent) {
			modalContent.empty();
			this.createAddNoteButton(modalContent as HTMLElement);
			this.displayPinnedNotes(modalContent as HTMLElement);
		} else {
			contentEl.empty();
			this.createAddNoteButton(contentEl);
			this.displayPinnedNotes(contentEl);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
