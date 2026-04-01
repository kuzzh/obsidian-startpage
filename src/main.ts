import { Plugin, WorkspaceLeaf, TFile, Menu, getLanguage } from "obsidian";
import { StartPageView, VIEW_TYPE_START_PAGE } from "@/views/startpageview";
import { StartPageSettingTab } from "@/views/startpagesettingtab";
import { StartPageSettings, DEFAULT_SETTINGS } from "@/types";
import { setLocale, t } from "@/i18n";
import { VersionChecker } from "@/utils/versionchecker";
import "@/types";

export default class StartPagePlugin extends Plugin {
	settings: StartPageSettings;
	backupDir: string = this.manifest.dir + "/backup";

	async onload() {
		await this.loadSettings();

		this.settings.scrollPosition = 0;
		this.saveSettings();

		// Use Obsidian's built-in language setting
		const obsidianLang = getLanguage() || "en";
		setLocale(obsidianLang);

		this.registerView(VIEW_TYPE_START_PAGE, (leaf) => new StartPageView(leaf, this.app, this));

		// Check for updates in background
		this.checkForUpdates();

		// Add ribbon button
		this.addRibbonIcon("home", "Open start page", () => {
			this.activateStartPage();
		});

		// Add settings tab
		this.addSettingTab(new StartPageSettingTab(this.app, this));

		// Add commands
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
					if (leaf && !leaf.view.getViewType().startsWith(VIEW_TYPE_START_PAGE)) {
						const state = leaf.getViewState();
						// If new empty tab, replace it with StartPage
						if (state.type === "empty" && !state.state?.file) {
							this.replaceWithStartPage(leaf);
						}
					}
				}
			}),
		);

		// Register file menu event for right-click context menu
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
				if (file instanceof TFile) {
					this.addPinnedNoteMenuItem(menu, file);
				}
			}),
		);
	}

	async loadSettings() {
		await this.backupSettings();

		const savedData = await this.loadData();

		if (savedData && typeof savedData === "object") {
			this.settings = {
				...DEFAULT_SETTINGS,
				...savedData,
				pinnedNotes: Array.isArray(savedData.pinnedNotes) ? savedData.pinnedNotes : [],
				recentNotesLimit: typeof savedData.recentNotesLimit === "number" ? savedData.recentNotesLimit : 10,
				includeAllFilesInRecent: typeof savedData.includeAllFilesInRecent === "boolean" ? savedData.includeAllFilesInRecent : true,
				replaceNewTab: typeof savedData.replaceNewTab === "boolean" ? savedData.replaceNewTab : true,
				showTitleNavigationBar: ["default", "show", "hide"].includes(savedData.showTitleNavigationBar) ? savedData.showTitleNavigationBar : "default",
				showCustomFooterText: typeof savedData.showCustomFooterText === "boolean" ? savedData.showCustomFooterText : false,
				useRandomFooterText: typeof savedData.useRandomFooterText === "boolean" ? savedData.useRandomFooterText : false,
				todayRandomEnFooterText: typeof savedData.todayRandomEnFooterText === "string" ? savedData.todayRandomEnFooterText : "",
				todayRandomZhFooterText: typeof savedData.todayRandomZhFooterText === "string" ? savedData.todayRandomZhFooterText : "",
				customFooterText: typeof savedData.customFooterText === "string" ? savedData.customFooterText : "",
				scrollPosition: typeof savedData.scrollPosition === "number" ? savedData.scrollPosition : 0,
				showStatBar: typeof savedData.showStatBar === "boolean" ? savedData.showStatBar : true,
				lastVersionCheck: typeof savedData.lastVersionCheck === "number" ? savedData.lastVersionCheck : 0,
				latestVersion: typeof savedData.latestVersion === "string" ? savedData.latestVersion : "",
				searchExcludePaths: Array.isArray(savedData.excludeList) ? savedData.excludeList : [],
				searchExcludeExtensions: Array.isArray(savedData.excludeExtensions) ? savedData.excludeExtensions : [],
				pinnedNotesStyle:
					typeof savedData.pinnedNotesStyle === "object"
						? { ...DEFAULT_SETTINGS.pinnedNotesStyle, ...savedData.pinnedNotesStyle }
						: { ...DEFAULT_SETTINGS.pinnedNotesStyle },
				recentNotesStyle:
					typeof savedData.recentNotesStyle === "object"
						? { ...DEFAULT_SETTINGS.recentNotesStyle, ...savedData.recentNotesStyle }
						: { ...DEFAULT_SETTINGS.recentNotesStyle },
				backupMaxFiles: typeof savedData.backupMaxFiles === "number" ? savedData.backupMaxFiles : DEFAULT_SETTINGS.backupMaxFiles,
			};
		} else {
			this.settings = { ...DEFAULT_SETTINGS };
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
					// Extract filename from path (works with both / and \ separators)
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

			// Sort by date (oldest first for deletion)
			fileDatePairs.sort((a, b) => a.timestamp - b.timestamp);

			// Delete oldest files beyond max limit
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
						// Remove from pinned notes
						this.settings.pinnedNotes = this.settings.pinnedNotes.filter((path) => path !== file.path);
					} else {
						// Add to pinned notes
						this.settings.pinnedNotes.push(file.path);
					}
					await this.saveSettings();

					// Refresh start page if it's open
					const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
					leaves.forEach((leaf) => {
						if (leaf.view instanceof StartPageView) {
							leaf.view.renderContent();
						}
					});
				});
		});
	}

	onunload() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE).forEach((leaf) => leaf.detach());
	}

	/**
	 * Check for plugin updates in background
	 */
	async checkForUpdates() {
		const now = Date.now();
		const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours

		// Check once per day
		if (now - this.settings.lastVersionCheck < ONE_DAY) {
			return;
		}

		try {
			const versionInfo = await VersionChecker.checkForUpdate(this.manifest.version);

			if (versionInfo && versionInfo.hasUpdate) {
				this.settings.latestVersion = versionInfo.latestVersion;
				this.settings.lastVersionCheck = now;
				await this.saveSettings();

				// Refresh start page views to show the update badge
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
				leaves.forEach((leaf) => {
					if (leaf.view instanceof StartPageView) {
						leaf.view.renderContent();
					}
				});
			} else {
				// No update, just update the check timestamp
				this.settings.lastVersionCheck = now;
				await this.saveSettings();
			}
		} catch (error) {
			console.error("Error checking for updates:", error);
		}
	}
}
