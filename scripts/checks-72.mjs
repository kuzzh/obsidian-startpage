// #72 验证：内容区布局三档（并排/并排反转/堆叠）的类切换与实际几何位置
export default async (page) => {
	return await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });
		const view = window.app.workspace.getLeavesOfType("start-page-view")[0].view;
		const setLayout = async (value) => {
			plugin.settings.contentLayout = value;
			await plugin.saveSettings();
			await view.renderContent();
			await wait(300);
		};
		const geometry = () => {
			const grid = document.querySelector(".content-grid");
			const pinned = grid.querySelector(".pinned-notes")?.getBoundingClientRect();
			const recent = grid.querySelector(".recent-notes")?.getBoundingClientRect();
			const gridRect = grid.getBoundingClientRect();
			return {
				cls: [...grid.classList].find((c) => c.startsWith("layout-")),
				pinnedLeft: Math.round(pinned?.left ?? -1),
				recentLeft: Math.round(recent?.left ?? -1),
				pinnedTop: Math.round(pinned?.top ?? -1),
				recentTop: Math.round(recent?.top ?? -1),
				pinnedWidth: Math.round(pinned?.width ?? 0),
				gridWidth: Math.round(gridRect.width),
			};
		};

		await wait(500);

		// ---- a. 默认并排：tabs 左、recent 右 ----
		await setLayout("columns");
		let g = geometry();
		assert(
			"columns: tabs left of recent",
			g.cls === "layout-columns" && g.pinnedLeft < g.recentLeft && g.pinnedTop === g.recentTop,
			JSON.stringify(g),
		);

		// ---- b. 并排反转：recent 左、tabs 右 ----
		await setLayout("columns-reversed");
		g = geometry();
		assert(
			"columns-reversed: recent left of tabs",
			g.cls === "layout-columns-reversed" && g.recentLeft < g.pinnedLeft && g.pinnedTop === g.recentTop,
			JSON.stringify(g),
		);

		// ---- c. 堆叠：tabs 在上、recent 在下、均全宽 ----
		await setLayout("stacked");
		g = geometry();
		assert(
			"stacked: tabs above recent, full width",
			g.cls === "layout-stacked" && g.pinnedTop < g.recentTop && g.pinnedLeft === g.recentLeft && g.pinnedWidth > g.gridWidth * 0.8,
			JSON.stringify(g),
		);

		// ---- cleanup ----
		await setLayout("columns");

		return results;
	});
};
