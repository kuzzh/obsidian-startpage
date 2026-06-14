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

export interface StartPageSettings {
	includeAllFilesInRecent: boolean;
	recentNotesLimit: number;
	showRecentAccessedNotes: boolean;
	pinnedNotes: string[];
	replaceNewTab: boolean;
	showTitleNavigationBar: "default" | "show" | "hide";
	showCustomFooterText: boolean;
	useRandomFooterText: boolean;
	todayRandomEnFooterText: string; 
	todayRandomZhFooterText: string; 
	customFooterText: string;
	scrollPosition: number; 
	showStatBar: boolean;
	lastVersionCheck: number; 
	latestVersion: string;
	searchExcludePaths: string[]; 
	searchExcludeExtensions: string[];
	pinnedNotesStyle: SectionStyleSettings;
	recentNotesStyle: SectionStyleSettings;
	backupMaxFiles: number;
}

export const DEFAULT_SETTINGS: StartPageSettings = {
	includeAllFilesInRecent: true,
	recentNotesLimit: 10,
	showRecentAccessedNotes: true,
	pinnedNotes: [],
	replaceNewTab: true,
	showTitleNavigationBar: "default",
	showCustomFooterText: false,
	useRandomFooterText: false,
	todayRandomEnFooterText: "",
	todayRandomZhFooterText: "",
	customFooterText: "",
	scrollPosition: 0,
	showStatBar: true,
	lastVersionCheck: 0,
	latestVersion: "",
	searchExcludePaths: [],
	searchExcludeExtensions: [],
	pinnedNotesStyle: { ...DEFAULT_SECTION_STYLE },
	recentNotesStyle: { ...DEFAULT_SECTION_STYLE },
	backupMaxFiles: 5,
};