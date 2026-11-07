import { App, ButtonComponent, Modal, TextComponent } from "obsidian";
import StartPagePlugin from "@/main";
import { DailyNoteUtil } from "@/utils/dailynoteutil";
import { StartPageView } from "@/views/startpageview";
import { t } from "@/i18n";

export default class CaptureModal extends Modal {
	private plugin: StartPagePlugin;
	private input: TextComponent;

	constructor(app: App, plugin: StartPagePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onClose() {
		// 同 SearchModal：清理 tabFocusContainerEl 污染并恢复主页焦点
		(this.scope as unknown as { setTabFocusContainerEl: (el: Element | null) => void }).setTabFocusContainerEl(null);
		const view = this.app.workspace.getActiveViewOfType(StartPageView);
		if (view) {
			view.focusContainer();
		}
	}

	onOpen() {
		this.setTitle(t("capture_title"));
		this.contentEl.addClass("start-page-capture-content");

		// 输入框占满剩余宽度，确定按钮靠右同行
		const row = this.contentEl.createDiv("capture-row");
		this.input = new TextComponent(row);
		this.input.setPlaceholder(t("capture_placeholder"));
		this.input.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				void this.submit();
			}
		});

		new ButtonComponent(row)
			.setButtonText(t("confirm"))
			.setCta()
			.onClick(() => void this.submit());

		window.setTimeout(() => this.input.inputEl.focus(), 50);
	}

	private async submit() {
		const value = this.input.getValue();
		if (!value.trim()) {
			return;
		}
		const file = await DailyNoteUtil.captureWithNotice(this.app, value);
		if (!file) {
			return;
		}
		// 追加后展示今日笔记；已在后台标签打开时直接激活，避免重复开标签
		const existing = this.app.workspace
			.getLeavesOfType("markdown")
			.find((leaf) => leaf.view.getState?.()?.file === file.path);
		if (existing) {
			this.close();
			await this.app.workspace.revealLeaf(existing);
		} else {
			await this.app.workspace.getLeaf("tab").openFile(file);
			this.close();
		}
	}
}
