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
	// section container
	sectionMargin: string;
	sectionPadding: string;
	
	// section header
	headerMargin: string;
	headerPadding: string;
	
	// section title
	titleFontSize: string;
	titleMargin: string;
	titlePadding: string;
	
	// notes list
	listGap: string;
	
	// note item
	itemPadding: string;
	itemMargin: string;
	
	// note title
	noteTitleFontSize: string;
	noteTitleMargin: string;
	noteTitlePadding: string;
	
	// note date
	noteDateFontSize: string;
	
	// note folder
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
	pinnedNotes: string[];
	replaceNewTab: boolean;
	showTitleNavigationBar: "default" | "show" | "hide";
	showCustomFooterText: boolean;
	useRandomFooterText: boolean;
	todayRandomEnFooterText: string; // 今日英文随机脚本文字,格式:2025118|I think,there for I am.
	todayRandomZhFooterText: string; // 今日中文随机脚本文字,格式:2025118|百日依山尽,黄河入海流
	customFooterText: string;
	scrollPosition: number; // Scroll position for start page
	showStatBar: boolean;
	lastVersionCheck: number; // Last time version check was performed
	latestVersion: string; // Latest version from GitHub
	excludeList: string[]; // List of files/folders to exclude from search
	pinnedNotesStyle: SectionStyleSettings;
	recentNotesStyle: SectionStyleSettings;
}

export const DEFAULT_SETTINGS: StartPageSettings = {
	includeAllFilesInRecent: true,
	recentNotesLimit: 10,
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
	excludeList: [],
	pinnedNotesStyle: { ...DEFAULT_SECTION_STYLE },
	recentNotesStyle: { ...DEFAULT_SECTION_STYLE },
};