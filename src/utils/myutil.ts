import { t } from "../i18n";
import { StartPageSettings } from "@/types";
import { App, TFile } from "obsidian";
import { StartPageView, VIEW_TYPE_START_PAGE } from "@/views/startpageview";

export class MyUtil {
	static truncateMiddle(str: string, head: number = 24, tail: number = 16): string {
		if (!str) return str;
		const len = str.length;
		if (len <= head + tail + 3) return str;
		const start = str.slice(0, head);
		const end = str.slice(-tail);
		return `${start}...${end}`;
	}

	static getDirPath(p: string): string {
		if (!p) return "/";
		const idx = p.lastIndexOf("/");
		if (idx === -1) return "/";
		const dir = p.slice(0, idx);
		return "/" + dir;
	}

	static getFileNameWithoutExtension(fileName: string): string {
		return fileName.slice(0, fileName.lastIndexOf("."));
	}

	static formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		if (diff < 24 * 60 * 60 * 1000) {
			const hours = Math.floor(diff / (60 * 60 * 1000));
			if (hours === 0) {
				const minutes = Math.floor(diff / (60 * 1000));
				return t("minutes_ago").replace("{minutes}", minutes.toString());
			}
			return t("hours_ago").replace("{hours}", hours.toString());
		}

		if (diff < 7 * 24 * 60 * 60 * 1000) {
			const days = Math.floor(diff / (24 * 60 * 60 * 1000));
			return t("days_ago").replace("{days}", days.toString());
		}

		return date.toLocaleDateString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	static formatSize(size: number): string {
		if (size < 1024) {
			return size + "B";
		} else if (size < 1024 * 1024) {
			return (size / 1024).toFixed(0) + "KB";
		} else if (size < 1024 * 1024 * 1024) {
			return (size / (1024 * 1024)).toFixed(0) + "MB";
		} else {
			return (size / (1024 * 1024 * 1024)).toFixed(0) + "GB";
		}
	}

	static isFileExcluded(settings: StartPageSettings, file: TFile): boolean {
		const excludeList = settings.searchExcludePaths;
		for (const excludePath of excludeList) {
			if (file.path === excludePath) {
				return true;
			}

			if (file.path.startsWith(excludePath + "/")) {
				return true;
			}
		}

		const excludeExtensions = settings.searchExcludeExtensions;
		if (excludeExtensions.length > 0) {
			const fileExt = file.extension.toLowerCase();
			if (excludeExtensions.includes(fileExt)) {
				return true;
			}
		}

		return false;
	}

	static refreshStartPage(app: App) {
		const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_START_PAGE);
		leaves.forEach((leaf) => {
			if (leaf.view instanceof StartPageView) {
				leaf.view.renderContent();
			}
		});
	}
}