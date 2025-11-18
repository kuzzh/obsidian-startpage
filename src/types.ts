export interface SVGTag {
	tagName: string;
	attributes: SVGTagAttribute;
}

export interface SVGTagAttribute {
	[key: string]: string | number | undefined;
}

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
};
