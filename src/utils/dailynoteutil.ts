import { App, Notice, TFile, moment, normalizePath } from "obsidian";
import { t } from "@/i18n";

// Obsidian 对 moment 的类型声明是命名空间，需转换后调用
const createMoment = moment as unknown as () => { format(format?: string): string };

export interface DailyNoteTarget {
	path: string;
}

export class DailyNoteUtil {
	// 按核心 Daily notes 插件的约定（格式/目录）定位今日笔记；未启用返回 null
	static getTarget(app: App): DailyNoteTarget | null {
		const internal = (app as unknown as { internalPlugins?: { getPluginById?: (id: string) => { enabled?: boolean; instance?: { options?: { format?: string; folder?: string } } } } }).internalPlugins;
		const daily = internal?.getPluginById?.("daily-notes");
		if (!daily?.enabled) {
			return null;
		}
		const options = daily.instance?.options ?? {};
		const format = options.format || "YYYY-MM-DD";
		const folder = (options.folder || "").replace(/\/+$/, "");
		// Obsidian 对 moment 的类型声明是命名空间，需转换后调用
		const name = createMoment().format(format);
		return { path: `${folder ? folder + "/" : ""}${name}.md` };
	}

	// 速记：把一句话按 “- HH:mm 内容” 追加到今日笔记末尾，不存在则创建
	static async capture(app: App, text: string): Promise<TFile | null> {
		const target = DailyNoteUtil.getTarget(app);
		if (!target) {
			return null;
		}
		const trimmed = text.trim();
		if (!trimmed) {
			return null;
		}
		const line = `- ${createMoment().format("HH:mm")} ${trimmed}\n`;
		const path = normalizePath(target.path);
		const existing = app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await app.vault.process(existing, (data) => (data === "" || data.endsWith("\n") ? data : data + "\n") + line);
			return existing;
		}
		const dir = path.substring(0, path.lastIndexOf("/"));
		if (dir && !app.vault.getAbstractFileByPath(dir)) {
			await app.vault.createFolder(dir);
		}
		return app.vault.create(path, line);
	}

	static async captureWithNotice(app: App, text: string): Promise<TFile | null> {
		const file = await DailyNoteUtil.capture(app, text);
		if (!file) {
			new Notice(t("capture_unavailable"));
		}
		return file;
	}
}
