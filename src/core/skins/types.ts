import type { App, TFile } from "obsidian";
import type StartPagePlugin from "@/main";
import type { StartPageSettings, UiStyle } from "@/types";

declare module "obsidian" {
	interface App {
		setting: {
			open(): void;
			openTabById(id: string): void;
		};
		commands: {
			executeCommandById(id: string): void;
		};
	}
}

export interface StatItem {
	id: string;
	data: {
		number: string | number;
		label: () => string;
	};
}

export interface TabFolderItem {
	folderPath: string;
	folderName: string;
	files: TFile[];
}

export interface TabSpec {
	id: string;
	label: string;
	notes: TFile[];
	closable: boolean;
	folderPath?: string;
}

export interface NoteBindingOptions {
	isPinned: boolean;
}

// 皮肤只消费控制器暴露的动作，保证两套界面的行为只有一份实现
export interface StartPageActions {
	openNote(note: TFile, options?: { newTab?: boolean; event?: MouseEvent }): void;
	togglePin(note: TFile, pin: boolean): void;
	reorderPin(srcPath: string, targetPath: string): void;
	movePinToEnd(srcPath: string): void;
	showSearch(): void;
	openSettings(): void;
	openCommunityPlugins(): void;
	openTodayEdited(): void;
	openPinnedManager(): void;
	setRecentLimit(limit: number): void;
	createNewNote(): void;
	openCapture(): void;
	openDailyNote(): void;
	revealInExplorer(note: TFile): void;
}

export interface StartPageContext {
	app: App;
	plugin: StartPagePlugin;
	settings: StartPageSettings;
	container: HTMLElement;
	stats: StatItem[];
	pinnedNotes: TFile[] | null;
	recentNotes: TFile[] | null;
	tabFolderItems: TabFolderItem[] | null;
	activeTabIndex: number;
	actions: StartPageActions;
	bindNoteItem(el: HTMLElement, note: TFile, options: NoteBindingOptions): void;
	setActiveTab(index: number): void;
	observeTabList(tabList: HTMLElement, update: () => void): void;
	setDraggingPinnedPath(path: string | null): void;
	getDraggingPinnedPath(): string | null;
}

export interface StartPageSkin {
	readonly style: UiStyle;
	render(ctx: StartPageContext): Promise<void>;
}
