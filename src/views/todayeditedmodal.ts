import { App, Modal, TFile, WorkspaceLeaf } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import { MyUtil } from "@/utils/myutil";
import { StartPageView, VIEW_TYPE_START_PAGE } from "@/views/startpageview";

// 「今日编辑」统计卡下钻：卡片只有数字，弹窗补足「今天改了哪些」
export default class TodayEditedModal extends Modal {
	private plugin: StartPagePlugin;

	constructor(app: App, plugin: StartPagePlugin) {
		super(app);
		this.plugin = plugin;
		this.setTitle(t("today_edited"));
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		contentEl.addClass("my-today-edited-content");
		modalEl.addClass("my-today-edited-modal");

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		// 与统计卡同口径：只统计 markdown，避免附件撑爆列表
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.stat.mtime >= today.getTime())
			.sort((a, b) => b.stat.mtime - a.stat.mtime);

		if (files.length === 0) {
			contentEl.createDiv("today-edited-empty", (el) => el.setText(t("today_edited_empty")));
			return;
		}

		const list = contentEl.createEl("ul", { cls: "today-edited-list" });
		for (const file of files) {
			const item = list.createEl("li", { cls: "today-edited-item" });

			const nameEl = item.createEl("span", { cls: "today-edited-item-name", text: file.basename });
			nameEl.setAttribute("title", file.basename);

			const metaEl = item.createEl("span", { cls: "today-edited-item-meta" });
			metaEl.setText(MyUtil.formatDate(file.stat.mtime));

			item.addEventListener("click", async () => {
				const existingLeaf = this.findOpenLeaf(file);
				if (existingLeaf) {
					await this.app.workspace.revealLeaf(existingLeaf);
				} else {
					const newLeaf = this.plugin.settings.openNotesInNewTab ? "tab" : false;
					this.app.workspace.openLinkText(file.path, "", newLeaf);
				}
				this.close();
			});

			item.addEventListener("mouseenter", (event) => {
				this.app.workspace.trigger("hover-link", {
					event: event,
					source: VIEW_TYPE_START_PAGE,
					hoverParent: item,
					targetEl: item,
					linktext: file.path,
					sourcePath: "",
				});
			});
		}
	}

	private findOpenLeaf(file: TFile): WorkspaceLeaf | null {
		const leaf = this.app.workspace.getLeavesOfType("markdown").find((candidate) => {
			const state = candidate.view.getState();
			return state["file"] === file.path;
		});
		return leaf || null;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// 与 searchmodal 相同：不清 tabFocusContainerEl 会让主页任意键搜索被 blur 掉
		(this.scope as unknown as { setTabFocusContainerEl: (el: Element | null) => void }).setTabFocusContainerEl(null);
		const view = this.app.workspace.getActiveViewOfType(StartPageView);
		if (view) {
			view.focusContainer();
		}
	}
}
