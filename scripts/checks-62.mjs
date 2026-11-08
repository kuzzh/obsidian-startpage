// #62 验证：最近列表 / 文件夹 tab 的空状态提示 + 置顶空状态的"去添加"CTA
export default async (page) => {
	return await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const view = window.app.workspace.getLeavesOfType("start-page-view")[0].view;
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });

		await wait(500); // 等冒烟断言后的渲染稳定

		// ---- a. 置顶空状态 CTA：点击后应打开置顶管理弹窗 ----
		const pinnedEmpty = document.querySelector(".tab-panel.active .notes-list-empty");
		const addBtn = pinnedEmpty?.querySelector(".notes-list-empty-action");
		assert("pinned empty CTA exists", !!addBtn, addBtn?.textContent ?? "missing");
		if (addBtn) {
			addBtn.click();
			await wait(400);
			const modalOpen = !!document.querySelector(".modal-container");
			assert("CTA opens pinned notes modal", modalOpen, "");
			// 合成 click 的 isTrusted=false 不会触发 Obsidian 弹窗关闭，用 Escape
			document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			await wait(400);
		}

		// ---- b. 最近列表空状态：排除所有 md 后列表应为空并显示提示 ----
		const origIncludeAll = plugin.settings.includeAllFilesInRecent;
		const origExcludeExt = [...plugin.settings.searchExcludeExtensions];
		plugin.settings.includeAllFilesInRecent = false;
		plugin.settings.searchExcludeExtensions = ["md"];
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);
		const recentEmpty = document.querySelector(".recent-notes .notes-list-empty");
		assert(
			"recent empty state hint",
			!!recentEmpty && recentEmpty.textContent.trim().length > 0,
			recentEmpty?.textContent ?? "missing",
		);
		plugin.settings.includeAllFilesInRecent = origIncludeAll;
		plugin.settings.searchExcludeExtensions = origExcludeExt;
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);

		// ---- c. 文件夹 tab 空状态：指向空文件夹 ----
		const origFolders = [...plugin.settings.tabFolderPaths];
		await window.app.vault.adapter.mkdir("_e2e62-empty");
		plugin.settings.tabFolderPaths = ["_e2e62-empty"];
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);
		document.querySelectorAll(".tab-item")[1]?.click();
		await wait(100);
		const folderEmpty = document.querySelector('.tab-panel[data-tab-index="1"] .notes-list-empty');
		assert(
			"folder tab empty state hint",
			!!folderEmpty && folderEmpty.textContent.trim().length > 0,
			folderEmpty?.textContent ?? "missing",
		);

		// ---- cleanup ----
		plugin.settings.tabFolderPaths = origFolders;
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);
		await window.app.vault.adapter.rmdir("_e2e62-empty", true);

		return results;
	});
};
