import { App, PluginSettingTab, Setting, TFile, Modal } from "obsidian";
import StartPagePlugin from "./main";
import { VIEW_TYPE_START_PAGE } from "./view";
import { setLocale, t } from "./i18n";

export interface StartPageSettings {
    language: string;
    recentNotesLimit: number;
    pinnedNotes: string[];
}

export const DEFAULT_SETTINGS: StartPageSettings = {
    language: "en",
    recentNotesLimit: 5,
    pinnedNotes: []
};

class NoteTreeModal extends Modal {
    private onSelect: (file: TFile) => void;
    private files: TFile[];

    constructor(app: App, files: TFile[], onSelect: (file: TFile) => void) {
        super(app);
        this.files = files;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('note-tree-modal');

        // 创建文件夹结构
        const folderStructure: { [key: string]: TFile[] } = {};

        this.files.forEach(file => {
            const parts = file.path.split('/');

            // Initialize parent folders
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
                if (!folderStructure[currentPath]) {
                    folderStructure[currentPath] = [];
                }
            }

            const folder = parts.slice(0, -1).join('/');
            // if (!folderStructure[folder]) {
            //     folderStructure[folder] = [];
            // }
            folderStructure[folder].push(file);
        });

        // 添加根节点
        const rootItem = contentEl.createDiv('tree-item');
        const rootContent = rootItem.createDiv('tree-item-content');
        const rootIcon = rootContent.createSpan('tree-item-icon');
        rootIcon.innerHTML = '📚';
        const rootName = rootContent.createSpan('tree-item-name');
        rootName.textContent = t("root_folder");

        // 递归创建树形结构
        const createTreeItem = (path: string, level: number, parentEl: HTMLElement) => {
            const item = parentEl.createDiv('tree-item');
            // item.style.marginLeft = `${(level - 1) * 10}px`;

            const isFolder = path !== '';
            const displayName = isFolder ? path.split('/').pop() || path : '';

            const itemContent = item.createDiv('tree-item-content');

            if (isFolder) {
                const toggle = itemContent.createSpan('tree-item-toggle');
                toggle.innerHTML = '▼';
                toggle.onclick = (e) => {
                    e.stopPropagation();
                    const children = item.querySelector('.tree-item-children');
                    if (children) {
                        children.classList.toggle('collapsed');
                        toggle.classList.toggle('collapsed');
                    }
                };

                const folderIcon = itemContent.createSpan('tree-item-icon');
                folderIcon.innerHTML = '📁';
                const folderName = itemContent.createSpan('tree-item-name');
                folderName.textContent = displayName;
            } else {
                item.style.marginLeft = `${(level - 1) * 10}px`;
            }

            if (folderStructure[path]) {
                const childrenContainer = item.createDiv('tree-item-children');

                // 添加文件
                folderStructure[path].slice().forEach(file => {
                    const fileItem = childrenContainer.createDiv('tree-item');
                    fileItem.style.marginLeft = `${(level - 1) * 10}px`;

                    const fileContent = fileItem.createDiv('tree-item-content');
                    const fileIcon = fileContent.createSpan('tree-item-icon');
                    fileIcon.innerHTML = '📄';
                    const fileName = fileContent.createSpan('tree-item-name');
                    fileName.textContent = file.basename;

                    fileContent.addEventListener('click', () => {
                        this.onSelect(file);
                        this.close();
                    });
                });

                // 递归处理子文件夹
                Object.keys(folderStructure)
                    .filter(subPath => subPath.startsWith(path + '/') && subPath.split('/').length === path.split('/').length + 1)
                    .sort()
                    .forEach(subPath => createTreeItem(subPath, level + 1, childrenContainer));
            }
        };

        // 从根目录开始创建树
        const rootChildren = rootItem.createDiv('tree-item-children');

        // 显示根目录下的文件
        Object.keys(folderStructure)
            .filter(path => !path.includes('/'))
            .sort()
            .forEach(path => createTreeItem(path, 1, rootChildren));

        // 模拟点击所有folder节点
        const toggleItems = rootChildren.querySelectorAll('.tree-item-toggle');
        toggleItems.forEach(item => {
            const toggle = item as HTMLElement;
            if (toggle) {
                toggle.click();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class StartPageSettingTab extends PluginSettingTab {
    plugin: StartPagePlugin;

    constructor(app: App, plugin: StartPagePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private refreshStartPage() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
        leaves.forEach(leaf => {
            if (leaf.view) {
                (leaf.view as any).renderContent();
            }
        });
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName(t("language"))
            .setDesc(t("language_desc"))
            .addDropdown(dropdown => {
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
            .addText(text => text
                .setPlaceholder(t("recent_notes_limit_placeholder"))
                .setValue(this.plugin.settings.recentNotesLimit.toString())
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.recentNotesLimit = num;
                        await this.plugin.saveSettings();
                        this.refreshStartPage();
                    }
                }));

        new Setting(containerEl)
            .setName(t("pinned_notes_setting"))
            .setDesc(t("pinned_notes_select_desc"))
            .addButton(button => button
                .setButtonText(t("pinned_notes_select"))
                .onClick(() => {
                    const files = this.app.vault.getMarkdownFiles();
                    new NoteTreeModal(this.app, files, async (file) => {
                        if (!this.plugin.settings.pinnedNotes.includes(file.path)) {
                            this.plugin.settings.pinnedNotes.push(file.path);
                            await this.plugin.saveSettings();
                            this.refreshStartPage();
                            this.display();
                        }
                    }).open();
                }));

        // 显示当前置顶笔记
        if (this.plugin.settings.pinnedNotes.length > 0) {
            containerEl.createEl('h3', { text: t("current_pinned_notes") });
            const pinnedList = containerEl.createEl('ul', {
                cls: 'pinned-note-list'
            });

            for (const path of this.plugin.settings.pinnedNotes) {
                const li = pinnedList.createEl('li', { cls: 'pinned-note-item' });
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file) {
                    li.createEl('span', { text: file.path });
                    li.createEl('button', {
                        text: t("pinned_notes_remove"),
                        cls: 'mod-warning remove-button'
                    }).onclick = async () => {
                        this.plugin.settings.pinnedNotes = this.plugin.settings.pinnedNotes.filter(p => p !== path);
                        await this.plugin.saveSettings();
                        this.refreshStartPage();
                        this.display();
                    };
                }
            }
        }
    }
} 