import { App, Modal, TFolder } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import SvgUtil from "@/utils/svgutil";
import { MyUtil } from "@/utils/myutil";

export default class TabFoldersModal extends Modal {
	private plugin: StartPagePlugin;
	private onSettingsChange: () => void;

	constructor(app: App, plugin: StartPagePlugin, onSettingsChange: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSettingsChange = onSettingsChange;
		this.setTitle(t("folder_tabs_settings_heading"));
	}

	onOpen() {
		this.renderContent();
	}

	onClose() {
		this.contentEl.empty();
	}

	private renderContent() {
		this.contentEl.empty();

		this.contentEl.createDiv({ cls: "tab-folders-modal-content" });

		this.createAddButton();
		this.createFolderList();
	}

	private createAddButton() {
		const addButton = this.contentEl.createEl("button", {
			cls: "mod-cta",
			text: t("add_folder"),
		});
		addButton.style.marginBottom = "16px";
		addButton.addEventListener("click", () => {
			this.openFolderSuggestModal();
		});
	}

	private openFolderSuggestModal() {
		import("@/views/foldersuggestmodal").then((module) => {
			const FolderSuggestModal = module.default;
			new FolderSuggestModal(this.app, (folder: TFolder) => {
				if (!this.plugin.settings.tabFolderPaths.includes(folder.path)) {
					this.plugin.settings.tabFolderPaths.push(folder.path);
					this.plugin.saveSettings();
					this.onSettingsChange();
					this.renderContent();
				}
			}).open();
		});
	}

	private createFolderList() {
		const list = this.contentEl.createEl("ul", { cls: "pinned-note-list" });

		if (this.plugin.settings.tabFolderPaths.length === 0) {
			const emptyItem = list.createEl("li", { cls: "pinned-note-item" });
			emptyItem.createSpan({ text: t("no_tab_folders") });
			return;
		}

		this.plugin.settings.tabFolderPaths.forEach((folderPath, index) => {
			const folder = this.app.vault.getAbstractFileByPath(folderPath);

			const listItem = list.createEl("li", { cls: "pinned-note-item" });

			const line1 = listItem.createDiv({ cls: "note-line1" });
			const titleSpan = line1.createSpan({ cls: "note-title", text: folder instanceof TFolder ? folder.name : MyUtil.getFileNameWithoutExtension(folderPath) });
			titleSpan.style.flex = "1";

			const line2 = listItem.createDiv({ cls: "note-line2" });
			const pathLine = line2.createSpan({ cls: "note-path" });
			const folderIcon = SvgUtil.createFolderIcon();
			folderIcon.classList.add("folder-icon");
			pathLine.appendChild(folderIcon);
			pathLine.createSpan({ cls: "note-path-text", text: MyUtil.truncateMiddle(folderPath) });

			const actionsDiv = line2.createDiv({ cls: "note-actions" });

			const removeBtn = actionsDiv.createEl("button", { cls: "control-button remove-button" });
			const removeIcon = SvgUtil.createRemoveIcon();
			removeBtn.appendChild(removeIcon);
			removeBtn.addEventListener("click", async () => {
				this.plugin.settings.tabFolderPaths = this.plugin.settings.tabFolderPaths.filter((p) => p !== folderPath);
				await this.plugin.saveSettings();
				this.onSettingsChange();
				this.renderContent();
			});
		});
	}
}
