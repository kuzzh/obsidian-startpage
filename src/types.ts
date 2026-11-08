export interface SVGTag {
	tagName: string;
	attributes: SVGTagAttribute;
}

export interface SVGTagAttribute {
	[key: string]: string | number | undefined;
}

export const ID_STAT_TOTAL_NOTES = "totalNotes";
export const ID_STAT_TODAY_EDITED = "todayEdited";
export const ID_STAT_TOTAL_SIZE = "totalSize";

export interface SectionStyleSettings {
	sectionMargin: string;
	sectionPadding: string;
	
	headerMargin: string;
	headerPadding: string;
	
	titleFontSize: string;
	titleMargin: string;
	titlePadding: string;
	
	listGap: string;
	
	itemPadding: string;
	itemMargin: string;
	
	noteTitleFontSize: string;
	noteTitleMargin: string;
	noteTitlePadding: string;
	
	noteDateFontSize: string;
	
	noteFolderFontSize: string;
}

export const DEFAULT_SECTION_STYLE: SectionStyleSettings = {
	sectionMargin: "",
	sectionPadding: "",
	headerMargin: "",
	headerPadding: "",
	titleFontSize: "",
	titleMargin: "",
	titlePadding: "",
	listGap: "",
	itemPadding: "",
	itemMargin: "",
	noteTitleFontSize: "",
	noteTitleMargin: "",
	noteTitlePadding: "",
	noteDateFontSize: "",
	noteFolderFontSize: "",
};

export type ContentLayout = "columns" | "columns-reversed" | "stacked";
export type ListDensity = "comfortable" | "compact";

export interface StartPageSettings {
	contentLayout: ContentLayout;
	listDensity: ListDensity;
	includeAllFilesInRecent: boolean;
	recentNotesLimit: number;
	showRecentAccessedNotes: boolean;
	showTabs: boolean;
	showRecentSection: boolean;
	pinnedNotes: string[];
	replaceNewTab: boolean;
	openNotesInNewTab: boolean;
	showTitleNavigationBar: "default" | "show" | "hide";
	showCustomFooterText: boolean;
	showShortcutHints: boolean;
	showDailyCapture: boolean;
	useRandomFooterText: boolean;
	todayRandomEnFooterText: string; 
	todayRandomZhFooterText: string; 
	customFooterText: string;
	scrollPosition: number;
	scrollPositionKey: string;
	showStatBar: boolean;
	showActivityHeatmap: boolean;
	showGreeting: boolean;
	lastVersionCheck: number;
	latestVersion: string;
	checkForUpdates: boolean;
	searchExcludePaths: string[]; 
	searchExcludeExtensions: string[];
		pinnedNotesStyle: SectionStyleSettings;
		recentNotesStyle: SectionStyleSettings;
		backupMaxFiles: number;
		tabFolderPaths: string[];
		tabFolderRecursive: boolean;
		newNoteTitleTemplate: string;
		newNoteFolderPath: string;
		newNoteConflict: "duplicate" | "open";
	}

export const DEFAULT_SETTINGS: StartPageSettings = {
	contentLayout: "columns",
	listDensity: "comfortable",
	includeAllFilesInRecent: true,
	recentNotesLimit: 10,
	showRecentAccessedNotes: true,
	showTabs: true,
	showRecentSection: true,
	pinnedNotes: [],
		replaceNewTab: true,
		openNotesInNewTab: false,
		showTitleNavigationBar: "default",
	showCustomFooterText: false,
	showShortcutHints: true,
	showDailyCapture: true,
	useRandomFooterText: false,
	todayRandomEnFooterText: "",
	todayRandomZhFooterText: "",
	customFooterText: "",
	scrollPosition: 0,
	scrollPositionKey: "",
	showStatBar: true,
	showActivityHeatmap: true,
	showGreeting: true,
	lastVersionCheck: 0,
	latestVersion: "",
	checkForUpdates: false,
	searchExcludePaths: [],
	searchExcludeExtensions: [],
		pinnedNotesStyle: { ...DEFAULT_SECTION_STYLE },
		recentNotesStyle: { ...DEFAULT_SECTION_STYLE },
		backupMaxFiles: 5,
		tabFolderPaths: [],
		tabFolderRecursive: true,
		newNoteTitleTemplate: "Untitled",
		newNoteFolderPath: "",
		newNoteConflict: "duplicate",
	};