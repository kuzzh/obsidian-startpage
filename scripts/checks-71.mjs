// #71 验证：活动热力图渲染（16 周 × 7 天）、今日格子色阶与悬浮提示、设置开关生效
export default async (page) => {
	return await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });
		const view = window.app.workspace.getLeavesOfType("start-page-view")[0].view;

		await wait(500);

		// ---- a. 结构：112 格、今日之前无隐藏格 ----
		const grid = document.querySelector(".header-meta .activity-grid");
		const cells = [...document.querySelectorAll(".activity-cell")];
		const future = document.querySelectorAll(".activity-future").length;
		assert("activity grid rendered in header meta with 112 cells", !!grid && cells.length === 112, `cells=${cells.length}`);
		assert("only trailing future cells hidden", future === 6 - new Date().getDay(), `future=${future}`);

		// ---- b. 今日格子的色阶与提示与 mtime 统计一致 ----
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const files = plugin.settings.includeAllFilesInRecent
			? window.app.vault.getFiles()
			: window.app.vault.getMarkdownFiles();
		const todayCount = files.filter((f) => {
			const d = new Date(f.stat.mtime);
			d.setHours(0, 0, 0, 0);
			return d.getTime() === todayStart.getTime();
		}).length;
		const expectedLevel = todayCount === 0 ? 0 : todayCount <= 2 ? 1 : todayCount <= 5 ? 2 : todayCount <= 9 ? 3 : 4;
		const lastCell = cells[cells.length - 1 - (6 - new Date().getDay())];
		assert(
			"today cell level matches mtime stats",
			lastCell.classList.contains(`activity-l${expectedLevel}`),
			`count=${todayCount} expected=l${expectedLevel} class=${lastCell.className}`,
		);
		assert(
			"today cell tooltip contains count",
			(lastCell.getAttribute("title") ?? "").includes(String(todayCount)),
			lastCell.getAttribute("title") ?? "missing",
		);

		// ---- c. 设置开关：关闭后热力图消失，恢复后回来 ----
		plugin.settings.showActivityHeatmap = false;
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);
		assert("heatmap hidden via setting", !document.querySelector(".header-meta .activity-grid"), "");
		plugin.settings.showActivityHeatmap = true;
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);
		assert("heatmap restored via setting", !!document.querySelector(".header-meta .activity-grid"), "");

		return results;
	});
};
