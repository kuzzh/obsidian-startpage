import { Plugin, WorkspaceLeaf, TFile, Menu, TFolder, TAbstractFile, getLanguage } from "obsidian";
import { StartPageView, VIEW_TYPE_START_PAGE } from "@/views/startpageview";
import { StartPageSettingTab } from "@/views/startpagesettingtab";
import { StartPageSettings, DEFAULT_SETTINGS } from "@/types";
import { setLocale, t } from "@/i18n";
import { VersionChecker } from "@/utils/versionchecker";
import { MyUtil } from "@/utils/myutil";

// 以 DEFAULT_SETTINGS 的字段类型为准做校验，新增设置项无需改动加载逻辑
function isTypeMatch(value: unknown, fallback: unknown): boolean {
	if (value === undefined || value === null) return false;
	if (Array.isArray(fallback)) return Array.isArray(value);
	if (typeof fallback === "object") return typeof value === "object" && !Array.isArray(value);
	return typeof value === typeof fallback;
}

function mergeSettings<T extends object>(
	defaults: T,
	saved: Record<string, unknown>,
	validators: Record<string, (v: unknown) => boolean> = {},
): T {
	const result = { ...defaults } as Record<string, unknown>;
	for (const key of Object.keys(defaults)) {
		const fallback = (defaults as Record<string, unknown>)[key];
		const value = saved[key];
		if (!isTypeMatch(value, fallback)) continue;
		if (validators[key] && !validators[key](value)) continue;
		// 嵌套对象（如分区样式）按字段合并，保留未覆盖的默认值
		if (fallback && typeof fallback === "object" && !Array.isArray(fallback) && value && typeof value === "object" && !Array.isArray(value)) {
			result[key] = mergeSettings(fallback as object, value as Record<string, unknown>, validators);
		} else {
			result[key] = value;
		}
	}
	return result as T;
}

export default class StartPagePlugin extends Plugin {
	settings: StartPageSettings;
	backupDir: string = this.manifest.dir + "/backup";

	async onload() {
		await this.loadSettings();

		const obsidianLang = getLanguage() || "en";
		setLocale(obsidianLang);

		this.registerView(VIEW_TYPE_START_PAGE, (leaf) => new StartPageView(leaf, this.app, this));

		this.checkForUpdates();

		this.addRibbonIcon("home", "Open start page", () => {
			this.activateStartPage();
		});

		this.addSettingTab(new StartPageSettingTab(this.app, this));

		this.addCommand({
			id: "open-start-page",
			name: t("open_start_page"),
			callback: () => {
				this.activateStartPage();
			},
		});

		this.addCommand({
			id: "open-start-page-new-tab",
			name: t("open_start_page_new_tab"),
			callback: () => {
				this.activateStartPageNewTab();
			},
		});

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf: WorkspaceLeaf | null) => {
				if (this.settings.replaceNewTab) {
					if (leaf && leaf.view.getViewType() !== VIEW_TYPE_START_PAGE) {
						const state = leaf.getViewState();
						if (state.type === "empty" && !state.state?.file) {
							this.replaceWithStartPage(leaf);
						}
					}
				}
			}),
		);

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
				if (file instanceof TFile) {
					this.addPinnedNoteMenuItem(menu, file);
				}
			}),
		);

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
				if (file instanceof TFolder) {
					this.addTabFolderMenuItem(menu, file);
				}
			}),
		);
	}

	async loadSettings() {
		await this.backupSettings();

		const savedData = await this.loadData();
		const saved = savedData && typeof savedData === "object" ? (savedData as Record<string, unknown>) : {};
		this.settings = mergeSettings(DEFAULT_SETTINGS, saved, {
			// 枚举型字段需限定取值范围
			showTitleNavigationBar: (v) => ["default", "show", "hide"].includes(v as string),
			newNoteConflict: (v) => ["duplicate", "open"].includes(v as string),
		});

		// 旧版字段迁移
		if (this.settings.searchExcludePaths.length === 0 && Array.isArray(saved.excludeList)) {
			this.settings.searchExcludePaths = saved.excludeList as string[];
		}
		if (this.settings.searchExcludeExtensions.length === 0 && Array.isArray(saved.excludeExtensions)) {
			this.settings.searchExcludeExtensions = saved.excludeExtensions as string[];
		}

		await this.cleanupOldBackups();
	}

	async backupSettings() {
		const backupFile = `${this.backupDir}/data-${new Date().toISOString().slice(0, 10)}.json`;

		const backupFileExists = await this.app.vault.adapter.exists(backupFile);
		if (!backupFileExists) {
			await this.app.vault.adapter.mkdir(this.backupDir);

			const dataFile = this.manifest.dir + "/data.json";
			if (await this.app.vault.adapter.exists(dataFile)) {
				const dataContent = await this.app.vault.adapter.read(dataFile);

				await this.app.vault.adapter.write(backupFile, dataContent);
			} else {
				console.log("data.json file does not exist, skipping backup");
			}
		}
	}

	private async cleanupOldBackups() {
		try {
			if (!(await this.app.vault.adapter.exists(this.backupDir))) {
				return;
			}

			const files = await this.app.vault.adapter.list(this.backupDir);
			const backupFiles = files.files.filter((file) => file.endsWith(".json") && file.includes("data-"));

			if (backupFiles.length === 0) {
				return;
			}

			const fileDatePairs = backupFiles
				.map((file) => {
					const lastSlashIndex = Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\"));
					const fileName = lastSlashIndex >= 0 ? file.substring(lastSlashIndex + 1) : file;
					const dateStr = fileName.replace("data-", "").replace(".json", "");
					return {
						file,
						date: new Date(dateStr),
						timestamp: new Date(dateStr).getTime(),
					};
				})
				.filter((pair) => !isNaN(pair.timestamp));

			fileDatePairs.sort((a, b) => a.timestamp - b.timestamp);

			if (fileDatePairs.length > this.settings.backupMaxFiles) {
				const filesToDelete = fileDatePairs.slice(0, fileDatePairs.length - this.settings.backupMaxFiles);

				for (const pair of filesToDelete) {
					try {
						await this.app.vault.adapter.remove(pair.file);
						console.log(`Deleted old backup file: ${pair.file}`);
					} catch (error) {
						console.error(`Failed to delete backup file ${pair.file}:`, error);
					}
				}
			}
		} catch (error) {
			console.error("Error cleaning up backup files:", error);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	findStartPageLeaf(): WorkspaceLeaf | null {
		const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
		if (existingLeaves.length > 0) {
			return existingLeaves[0];
		}
		return null;
	}

	async activateStartPage() {
		try {
			const leaf = this.app.workspace.getLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_START_PAGE,
					active: true,
				});
			}
		} catch (error) {
			console.error("Failed to create Start Page leaf:", error);
		}
	}

	async activateStartPageNewTab() {
		try {
			const leaf = this.app.workspace.getLeaf(true);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_START_PAGE,
					active: true,
				});
			}
		} catch (error) {
			console.error("Failed to create Start Page leaf in new tab:", error);
		}
	}

	async replaceWithStartPage(leaf: WorkspaceLeaf) {
		try {
			await leaf.setViewState({
				type: VIEW_TYPE_START_PAGE,
				active: true,
			});
		} catch (error) {
			console.error("Failed to replace with Start Page:", error);
		}
	}

	addPinnedNoteMenuItem(menu: Menu, file: TFile) {
		const isPinned = this.settings.pinnedNotes.includes(file.path);

		menu.addItem((item) => {
			item.setTitle(isPinned ? t("remove_from_pinned_notes") : t("add_to_pinned_notes"))
				.setIcon(isPinned ? "pin-off" : "pin")
				.onClick(async () => {
					if (isPinned) {
						this.settings.pinnedNotes = this.settings.pinnedNotes.filter((path) => path !== file.path);
					} else {
						this.settings.pinnedNotes.push(file.path);
					}
					await this.saveSettings();

					MyUtil.refreshStartPage(this.app);
				});
		});
	}

	addTabFolderMenuItem(menu: Menu, folder: TFolder) {
		const isInTabs = this.settings.tabFolderPaths.includes(folder.path);

		menu.addItem((item) => {
			item.setTitle(isInTabs ? t("remove_from_tab_folders") : t("add_to_tab_folders"))
				.setIcon(isInTabs ? "trash-2" : "folder-plus")
				.onClick(async () => {
					if (isInTabs) {
						this.settings.tabFolderPaths = this.settings.tabFolderPaths.filter((p) => p !== folder.path);
					} else {
						this.settings.tabFolderPaths.push(folder.path);
					}
					await this.saveSettings();

					MyUtil.refreshStartPage(this.app);
				});
		});
	}

	onunload() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE).forEach((leaf) => leaf.detach());
	}

	async checkForUpdates() {
		// 关闭检查更新时不发起任何网络请求，同时清掉残留的更新徽标数据
		if (!this.settings.checkForUpdates) {
			if (this.settings.latestVersion) {
				this.settings.latestVersion = "";
				await this.saveSettings();
			}
			return;
		}

		const now = Date.now();
		const ONE_DAY = 24 * 60 * 60 * 1000;

		if (now - this.settings.lastVersionCheck < ONE_DAY) {
			return;
		}

		try {
			const versionInfo = await VersionChecker.checkForUpdate(this.manifest.version);

			if (versionInfo && versionInfo.hasUpdate) {
				this.settings.latestVersion = versionInfo.latestVersion;
				this.settings.lastVersionCheck = now;
				await this.saveSettings();

				MyUtil.refreshStartPage(this.app);
			} else {
				this.settings.lastVersionCheck = now;
				await this.saveSettings();
			}
		} catch (error) {
			console.error("Error checking for updates:", error);
		}
	}
}
