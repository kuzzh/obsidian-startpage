import { App, Modal, Setting, TFolder } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import FileFolderSuggestModal from "@/views/filefoldersuggestmodal";

export default class SearchExclusionModal extends Modal {
    private plugin: StartPagePlugin;
    private onSettingsChange: () => void;

    constructor(app: App, plugin: StartPagePlugin, onSettingsChange: () => void) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChange = onSettingsChange;
        this.setTitle(t("search_exclusion_modal_title"));
    }

    onOpen() {
        const { contentEl } = this;

        // 排除路径设置
        new Setting(contentEl)
            .setName(t("search_exclude_list"))
            .setDesc(t("search_exclude_list_desc"))
            .addButton((button) => {
                button.setButtonText(t("search_exclude_list_add_button"))
                    .onClick(() => {
                        new FileFolderSuggestModal(this.app, async (item) => {
                            if (!this.plugin.settings.searchExcludePaths.includes(item.path)) {
                                this.plugin.settings.searchExcludePaths.push(item.path);
                                await this.plugin.saveSettings();
                                this.refreshDisplay();
                                this.onSettingsChange();
                            }
                        }).open();
                    });
            });

        this.renderPathsList(contentEl);

        // 排除扩展名设置
        new Setting(contentEl)
            .setName(t("search_exclude_extensions"))
            .setDesc(t("search_exclude_extensions_desc"))
            .addText((text) => {
                text.setPlaceholder(t("search_exclude_extensions_placeholder"));
                text.inputEl.addClass("extension-input");
                text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        const addButton = text.inputEl.parentElement?.parentElement?.querySelector("button") as HTMLButtonElement;
                        addButton?.click();
                    }
                });
            })
            .addButton((button) => {
                button.setButtonText(t("search_exclude_extensions_add"))
                    .onClick(async () => {
                        const inputEl = button.buttonEl.parentElement?.querySelector(".extension-input") as HTMLInputElement;
                        const value = inputEl?.value.trim().toLowerCase() || "";
                        if (value) {
                            const extension = value.startsWith(".") ? value.slice(1) : value;
                            const extensions = extension.split(/[,\s]+/).filter(ext => ext.length > 0);
                            
                            let added = false;
                            for (const ext of extensions) {
                                if (!this.plugin.settings.searchExcludeExtensions.includes(ext)) {
                                    this.plugin.settings.searchExcludeExtensions.push(ext);
                                    added = true;
                                }
                            }
                            
                            if (added) {
                                await this.plugin.saveSettings();
                                if (inputEl) inputEl.value = "";
                                this.refreshDisplay();
                                this.onSettingsChange();
                            }
                        }
                    });
            });

        this.renderExtensionsList(contentEl);
    }

    private renderPathsList(containerEl: HTMLElement) {
        const existingList = containerEl.querySelector(".exclusion-paths-list");
        if (existingList) existingList.remove();

        if (this.plugin.settings.searchExcludePaths.length === 0) {
            return;
        }

        const listContainer = containerEl.createDiv({ cls: "exclusion-paths-list" });

        this.plugin.settings.searchExcludePaths.forEach((path, index) => {
            const item = this.app.vault.getAbstractFileByPath(path);
            const isFolder = item instanceof TFolder;

            new Setting(listContainer)
                .setName(path)
                .setDesc(isFolder ? t("folder") : t("file"))
                .addExtraButton((button) => {
                    button.setIcon("cross")
                        .setTooltip(t("search_exclude_list_remove"))
                        .onClick(async () => {
                            this.plugin.settings.searchExcludePaths.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.refreshDisplay();
                            this.onSettingsChange();
                        });
                });
        });
    }

    private renderExtensionsList(containerEl: HTMLElement) {
        const existingList = containerEl.querySelector(".extension-tags-container");
        if (existingList) existingList.remove();

        if (this.plugin.settings.searchExcludeExtensions.length === 0) {
            return;
        }

        const tagsContainer = containerEl.createDiv({ cls: "extension-tags-container" });

        this.plugin.settings.searchExcludeExtensions.forEach((ext, index) => {
            new Setting(tagsContainer)
                .setName(`.${ext}`)
                .addExtraButton((button) => {
                    button.setIcon("cross")
                        .setTooltip(t("search_exclude_extensions_remove"))
                        .onClick(async () => {
                            this.plugin.settings.searchExcludeExtensions.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.refreshDisplay();
                            this.onSettingsChange();
                        });
                });
        });
    }

    private refreshDisplay() {
        const { contentEl } = this;
        contentEl.empty();
        this.onOpen();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
