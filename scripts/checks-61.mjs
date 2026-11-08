// #61 验证：vault 事件触发整页重渲染后，激活 tab 必须保持不变
export default async (page) => {
	return await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });
		const activeIndex = () =>
			[...document.querySelectorAll(".tab-item")].findIndex((el) => el.classList.contains("active"));
		const tabLabels = () => [...document.querySelectorAll(".tab-item")].map((el) => el.textContent.trim());
		const view = window.app.workspace.getLeavesOfType("start-page-view")[0]?.view;

		await wait(500); // 等前置冒烟断言后的渲染稳定

		// ---- arrange：确保存在文件夹 tab（settings 为空则取第一个含笔记的文件夹）----
		const originalFolders = [...plugin.settings.tabFolderPaths];
		let arranged = originalFolders.length > 0;
		if (!arranged) {
			const findFolder = (folder) => {
				for (const child of folder.children) {
					if (child.children) {
						if (child.children.some((c) => c.stat)) return child.path;
						const found = findFolder(child);
						if (found) return found;
					}
				}
				return null;
			};
			const folderPath = findFolder(window.app.vault.getRoot());
			if (folderPath) {
				plugin.settings.tabFolderPaths = [folderPath];
				await plugin.saveSettings();
				await view.renderContent();
				await wait(300);
				arranged = true;
			}
		}
		assert("folder tab arranged", arranged, `tabFolderPaths=${plugin.settings.tabFolderPaths.join(",")}`);
		if (!arranged) return results;

		assert("tab count >= 2", document.querySelectorAll(".tab-item").length >= 2, `labels=${tabLabels().join("|")}`);

		// ---- act 1：切到第 2 个 tab，再触发 vault 事件 → 整页重渲染 ----
		document.querySelectorAll(".tab-item")[1].click();
		await wait(100);
		assert("click switches to tab 1", activeIndex() === 1, `active=${activeIndex()}`);

		const tmp = await window.app.vault.create("_e2e61-tmp.md", "# tmp\n");
		await wait(1500); // debounce 500ms + 渲染
		assert(
			"active tab persists after vault create event",
			activeIndex() === 1,
			`active=${activeIndex()} labels=${tabLabels().join("|")}`,
		);

		// ---- act 2（反向对照）：切回 tab 0，modify 事件后仍应停在 tab 0 ----
		document.querySelectorAll(".tab-item")[0].click();
		await wait(100);
		await window.app.vault.modify(tmp, "# tmp\nmore\n");
		await wait(1500);
		assert(
			"active tab persists (stays 0) after vault modify event",
			activeIndex() === 0,
			`active=${activeIndex()}`,
		);

		// ---- cleanup：恢复现场 ----
		await window.app.vault.delete(tmp);
		if (originalFolders.length === 0) {
			plugin.settings.tabFolderPaths = originalFolders;
			await plugin.saveSettings();
			await view.renderContent();
			await wait(300);
		}

		return results;
	});
};
