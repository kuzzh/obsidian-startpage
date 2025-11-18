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

export interface StartPageSettings {
	includeAllFilesInRecent: boolean;
	recentNotesLimit: number;
	pinnedNotes: string[];
	replaceNewTab: boolean;
	showTitleNavigationBar: "default" | "show" | "hide";
	showCustomFooterText: boolean;
	useRandomFooterText: boolean;
	todayRandomEnFooterText: string; // 今日英文随机脚本文字，格式：2025118|I think,there for I am.
	todayRandomZhFooterText: string; // 今日中文随机脚本文字，格式：2025118|百日依山尽，黄河入海流
	customFooterText: string;
	scrollPosition: number; // Scroll position for start page
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
};