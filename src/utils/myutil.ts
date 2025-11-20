
import { t } from "../i18n";

export class MyUtil {
    /**
     * 将路径字符串进行中间省略，保留头尾以提升可读性
     */
    static truncateMiddle(str: string, head: number = 24, tail: number = 16): string {
        if (!str) return str;
        const len = str.length;
        if (len <= head + tail + 3) return str;
        const start = str.slice(0, head);
        const end = str.slice(-tail);
        return `${start}...${end}`;
    }

    /**
     * 获取笔记所属目录路径；根目录返回 "/"
     */
    static getDirPath(p: string): string {
        if (!p) return "/";
        const idx = p.lastIndexOf("/");
        if (idx === -1) return "/";
        const dir = p.slice(0, idx);
        return "/" + dir;
    }

    /**
     * 获取文件名（不包括扩展名）
     */
	static getFileNameWithoutExtension(fileName: string): string {
		return fileName.slice(0, fileName.lastIndexOf("."));
	}

    /**
     * 格式化时间戳为相对时间
     */
    static formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		// Less than 24 hours
		if (diff < 24 * 60 * 60 * 1000) {
			const hours = Math.floor(diff / (60 * 60 * 1000));
			if (hours === 0) {
				const minutes = Math.floor(diff / (60 * 1000));
				return t("minutes_ago").replace("{minutes}", minutes.toString());
			}
			return t("hours_ago").replace("{hours}", hours.toString());
		}

		// Less than 7 days
		if (diff < 7 * 24 * 60 * 60 * 1000) {
			const days = Math.floor(diff / (24 * 60 * 60 * 1000));
			return t("days_ago").replace("{days}", days.toString());
		}

		// Otherwise show full date
		return date.toLocaleDateString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

    /**
     * 格式化文件大小
     */
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
}