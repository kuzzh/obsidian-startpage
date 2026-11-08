// #64 验证：条目动作统一收进单个 ⋯ 菜单（置顶/取消置顶、新标签打开、文件管理器显示）
// 菜单项回调依赖可信事件，点击一律走 Playwright 真实输入而非合成 click
export default async (page) => {
	const wait = (ms) => new Promise((r) => setTimeout(r, ms));
	const results = [];
	const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });

	await page.waitForSelector(".start-page-container", { timeout: 10000 });
	await wait(500); // 等冒烟断言后的渲染稳定

	// ---- a. 动作区仅一个 ⋯ 按钮 ----
	const item = page.locator(".recent-notes .note-item").first();
	const moreBtn = item.locator(".note-actions .btn-icon");
	const btnCount = await moreBtn.count();
	assert("note item has a single more button", btnCount === 1, `got ${btnCount}`);
	const notePath = await item.getAttribute("data-note-path");

	// ---- b. ⋯ 菜单：置顶 + 分隔线 + 两个低频动作 ----
	await moreBtn.click();
	await page.waitForSelector(".menu", { timeout: 5000 });
	const menuItems = page.locator(".menu .menu-item");
	const menuCount = await menuItems.count();
	assert("menu has 3 items", menuCount === 3, `got ${menuCount}`);
	const pinLabel = (await menuItems.first().textContent()) ?? "";
	assert("first item is pin action", /add to pinned/i.test(pinLabel), pinLabel.trim());

	// ---- c. 菜内置顶 → settings 写入且置顶面板出现条目 ----
	await menuItems.first().click();
	await wait(700);
	let pinned = await page.evaluate((p) => window.app.plugins.plugins["start-page"].settings.pinnedNotes.includes(p), notePath);
	assert("menu pin action works", pinned, "");
	await page.locator(".tab-item").first().click();
	await wait(200);
	const pinnedMore = page.locator(`.tab-panel[data-tab-index="0"] .note-item[data-note-path="${notePath}"] .note-actions .btn-icon`);
	assert("pinned panel shows the note", (await pinnedMore.count()) === 1, "");

	// ---- d. 置顶条目菜单第一项为取消置顶，点击后恢复 ----
	await pinnedMore.click();
	await page.waitForSelector(".menu", { timeout: 5000 });
	const unpinLabel = (await page.locator(".menu .menu-item").first().textContent()) ?? "";
	assert("pinned item menu offers unpin", /remove from pinned/i.test(unpinLabel), unpinLabel.trim());
	await page.locator(".menu .menu-item").first().click();
	await wait(700);
	pinned = await page.evaluate((p) => window.app.plugins.plugins["start-page"].settings.pinnedNotes.includes(p), notePath);
	assert("menu unpin action works", !pinned, "");

	// ---- e. 菜单不残留 ----
	assert("no leftover menu", (await page.locator(".menu").count()) === 0, "");

	return results;
};
