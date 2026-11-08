// #65 验证：置顶笔记可拖到列表末尾（列表空白区落点追加），条目间拖放排序不受影响
// 插件拖放逻辑不读取 dataTransfer，可用合成 DragEvent 驱动断言
export default async (page) => {
	return await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });
		const view = window.app.workspace.getLeavesOfType("start-page-view")[0].view;

		await wait(500);

		// ---- arrange：三个置顶笔记 ----
		const origPinned = [...plugin.settings.pinnedNotes];
		const files = window.app.vault.getMarkdownFiles().slice(0, 3).map((f) => f.path);
		if (files.length < 3) {
			assert("vault has 3 notes for arrange", false, `got ${files.length}`);
			return results;
		}
		plugin.settings.pinnedNotes = [...files];
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);

		const domOrder = () =>
			[...document.querySelectorAll('.tab-panel[data-tab-index="0"] .note-item')].map((el) => el.getAttribute("data-note-path"));
		const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true }));
		const dragTo = (srcPath, targetEl) => {
			const src = document.querySelector(`.tab-panel[data-tab-index="0"] .note-item[data-note-path="${srcPath}"]`);
			fire(src, "dragstart");
			fire(targetEl, "dragover");
			fire(targetEl, "drop");
			fire(src, "dragend");
		};

		assert("arranged order", JSON.stringify(domOrder()) === JSON.stringify(files), domOrder().join(","));

		// ---- a. 拖第 1 条到列表空白区 → 追加到末尾 ----
		const list = document.querySelector('.tab-panel[data-tab-index="0"] .notes-list');
		dragTo(files[0], list);
		await wait(700); // saveSettings + refreshStartPage
		assert(
			"drop on list blank area moves to end",
			JSON.stringify(domOrder()) === JSON.stringify([files[1], files[2], files[0]]),
			domOrder().join(","),
		);

		// ---- b. 条目间拖放排序不受影响：把末尾条目拖到第 1 条上 ----
		dragTo(files[0], document.querySelector(`.tab-panel[data-tab-index="0"] .note-item[data-note-path="${files[1]}"]`));
		await wait(700);
		assert(
			"item-to-item reorder still works",
			JSON.stringify(domOrder()) === JSON.stringify([files[0], files[1], files[2]]),
			domOrder().join(","),
		);

		// ---- cleanup ----
		plugin.settings.pinnedNotes = origPinned;
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);

		return results;
	});
};
