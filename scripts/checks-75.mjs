// #75 验证：布局选择即最终布局，只有手机宽度(<768)强制堆叠；侧栏开关不再影响列数
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const setSidebars = async (page, open) => {
	await page.evaluate((open) => {
		const ws = window.app.workspace;
		if (open) {
			ws.leftSplit.expand();
			ws.rightSplit.expand();
		} else {
			ws.leftSplit.collapse();
			ws.rightSplit.collapse();
		}
	}, open);
	await sleep(600);
};

const measure = (page) =>
	page.evaluate(() => {
		const leaf = document.querySelector(".workspace-leaf.mod-active .start-page-container");
		const grid = leaf?.querySelector(".content-grid");
		const cols = grid ? getComputedStyle(grid).gridTemplateColumns : null;
		const pinned = leaf?.querySelector(".content-grid .pinned-notes");
		const recent = leaf?.querySelector(".content-grid .recent-notes");
		return {
			winW: window.innerWidth,
			contW: leaf ? Math.round(leaf.getBoundingClientRect().width) : null,
			numCols: cols ? cols.split(" ").length : 0,
			cols,
			pinnedOrder: pinned ? getComputedStyle(pinned).order : null,
			recentOrder: recent ? getComputedStyle(recent).order : null,
		};
	});

const setLayout = async (page, layout) => {
	await page.evaluate(async (layout) => {
		const plugin = window.app.plugins.plugins["start-page"];
		plugin.settings.contentLayout = layout;
		const view = window.app.workspace.getLeavesOfType("start-page-view")[0].view;
		await view.renderContent();
	}, layout);
	await sleep(400);
};

export default async (page) => {
	const results = [];
	const assert = (name, pass, detail) => results.push({ name, pass, detail: JSON.stringify(detail) });

	await setLayout(page, "columns");

	// 桌面窄窗口：此前 <1200 会强制堆叠，现在应尊重「并排」
	await page.setViewportSize({ width: 1190, height: 900 });
	await setSidebars(page, false);
	const narrow = await measure(page);
	assert("desktop 1190px keeps side-by-side", narrow.numCols === 2, narrow);

	// 侧栏展开、内容区变窄，仍是并排（与 #75 报告的「侧栏开着反而并排」一致，现在也依然并排）
	await page.setViewportSize({ width: 1600, height: 900 });
	await setSidebars(page, true);
	const wideOpen = await measure(page);
	assert("sidebars open still side-by-side", wideOpen.numCols === 2 && wideOpen.contW < 1200, wideOpen);

	await setSidebars(page, false);

	// 手机宽度：强制堆叠
	await page.setViewportSize({ width: 390, height: 844 });
	await sleep(400);
	const mobile = await measure(page);
	assert("mobile 390px forces stacked", mobile.numCols === 1, mobile);

	// 显式「堆叠」在宽屏也保持单列
	await page.setViewportSize({ width: 1600, height: 900 });
	await sleep(400);
	await setLayout(page, "stacked");
	const stacked = await measure(page);
	assert("explicit stacked stays single column at 1600px", stacked.numCols === 1, stacked);

	// 「并排（标签页在右）」的 order 不被破坏
	await setLayout(page, "columns-reversed");
	const reversed = await measure(page);
	assert(
		"columns-reversed keeps pinned after recent",
		reversed.numCols === 2 && reversed.pinnedOrder === "2" && reversed.recentOrder === "1",
		reversed,
	);

	await setLayout(page, "columns");
	return results;
};
