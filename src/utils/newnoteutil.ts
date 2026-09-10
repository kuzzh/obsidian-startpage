import { App, Notice, TFile, TFolder, moment, normalizePath } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";

const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";
const DEFAULT_TIME_FORMAT = "HHmmss";
const DEFAULT_DATETIME_FORMAT = "YYYY-MM-DD_HHmmss";

const FALLBACK_TITLE = "Untitled";
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const PLACEHOLDER_REGEX = /\{\{(date|time|datetime)(?::([^}]*))?\}\}/g;

// Obsidian re-exports moment, but its type is declared as a namespace and is not callable.
const createMoment = moment as unknown as (input?: Date) => { format(format?: string): string };

export class NewNoteUtil {
	static renderTitle(template: string, now: Date = new Date()): string {
		const source = template && template.trim() ? template : FALLBACK_TITLE;

		const rendered = source.replace(PLACEHOLDER_REGEX, (_match, type: string, format?: string) => {
			const customFormat = format ? format.trim() : "";
			if (customFormat) {
				return createMoment(now).format(customFormat);
			}

			if (type === "time") {
				return createMoment(now).format(DEFAULT_TIME_FORMAT);
			}
			if (type === "datetime") {
				return createMoment(now).format(DEFAULT_DATETIME_FORMAT);
			}
			return createMoment(now).format(DEFAULT_DATE_FORMAT);
		});

		const sanitized = rendered
			.replace(ILLEGAL_FILENAME_CHARS, "-")
			.replace(/\s+/g, " ")
			.replace(/^[\s.]+/, "")
			.replace(/[\s.]+$/, "");

		return sanitized || FALLBACK_TITLE;
	}

	static async ensureFolder(app: App, folderPath: string): Promise<TFolder | null> {
		const normalized = normalizePath((folderPath || "").trim());
		if (!normalized || normalized === "/") {
			return app.vault.getRoot();
		}

		const existing = app.vault.getAbstractFileByPath(normalized);
		if (existing instanceof TFolder) {
			return existing;
		}
		if (existing instanceof TFile) {
			return null;
		}

		let currentFolder: TFolder = app.vault.getRoot();
		const segments = normalized.split("/").filter((segment) => segment.length > 0);
		let currentPath = "";

		for (const segment of segments) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;

			const child = app.vault.getAbstractFileByPath(currentPath);
			if (child instanceof TFolder) {
				currentFolder = child;
			} else if (child instanceof TFile) {
				return null;
			} else {
				currentFolder = await app.vault.createFolder(currentPath);
			}
		}

		return currentFolder;
	}

	static async createNote(app: App, plugin: StartPagePlugin): Promise<TFile | null> {
		const baseName = NewNoteUtil.renderTitle(plugin.settings.newNoteTitleTemplate);

		const folder = await NewNoteUtil.ensureFolder(app, plugin.settings.newNoteFolderPath);
		if (!folder) {
			new Notice(t("new_note_invalid_folder"));
			return null;
		}

		const basePath = folder.isRoot() ? baseName : `${folder.path}/${baseName}`;

		if (plugin.settings.newNoteConflict === "open") {
			const existing = app.vault.getAbstractFileByPath(normalizePath(`${basePath}.md`));
			if (existing instanceof TFile) {
				return existing;
			}
		}

		let index = 0;
		let fullPath = normalizePath(`${basePath}.md`);
		while (app.vault.getAbstractFileByPath(fullPath)) {
			index++;
			fullPath = normalizePath(`${basePath} ${index}.md`);
		}

		return app.vault.create(fullPath, "");
	}
}
