// #70 验证：右下角单按钮 + 右键菜单（打开今日日记 / 速记）；菜单项需可信事件，走 Playwright 真实点击
export default async (page) => {
	const wait = (ms) => new Promise((r) => setTimeout(r, ms));
	const results = [];
	const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });

	// 不依赖 verify 的打开时序：重建 start page leaf
	await page.evaluate(() => {
		window.app.workspace.getLeavesOfType("start-page-view").forEach((l) => l.detach());
		window.app.commands.executeCommandById("start-page:open-start-page");
	});
	await page.waitForSelector(".start-page-container", { timeout: 10000 });
	await wait(500);

	// ---- a. 浮动按钮收敛为单个 ----
	const buttons = await page.evaluate(() => ({
		newNote: !!document.querySelector(".start-page-new-note-btn"),
		capture: !!document.querySelector(".start-page-capture-btn"),
		daily: !!document.querySelector(".start-page-daily-btn"),
	}));
	assert(
		"single floating button remains",
		buttons.newNote && !buttons.capture && !buttons.daily,
		JSON.stringify(buttons),
	);

	// 今日日记路径（核心插件 format/folder 约定）
	const expectedPath = await page.evaluate(() => {
		const daily = window.app.internalPlugins.getPluginById("daily-notes");
		const opts = daily?.instance?.options ?? {};
		const format = opts.format || "YYYY-MM-DD";
		const folder = (opts.folder || "").replace(/\/+$/, "");
		const name = window.moment().format(format);
		return `${folder ? folder + "/" : ""}${name}.md`;
	});
	// 从「未创建」状态开始
	await page.evaluate((p) => {
		const f = window.app.vault.getAbstractFileByPath(p);
		if (f) window.app.vault.delete(f);
	}, expectedPath);
	await wait(500);

	// ---- b. 右键主按钮 → 菜单两项；点「打开今日日记」→ 创建并打开 ----
	await page.locator(".start-page-new-note-btn").click({ button: "right" });
	await page.waitForSelector(".menu", { timeout: 5000 });
	const menuItems = page.locator(".menu .menu-item");
	const itemCount = await menuItems.count();
	assert("context menu has 2 daily actions", itemCount === 2, `got ${itemCount}`);

	await menuItems.first().click();
	await wait(1200);
	const created = await page.evaluate((p) => {
		const f = window.app.vault.getAbstractFileByPath(p);
		return { exists: !!f, active: window.app.workspace.getActiveFile()?.path ?? null };
	}, expectedPath);
	assert("menu opens/creates today's daily note", created.exists && created.active === expectedPath, JSON.stringify(created));

	// ---- c. 再次右键 → 速记项打开 CaptureModal ----
	await page.evaluate(() => window.app.commands.executeCommandById("start-page:open-start-page"));
	await page.waitForSelector(".start-page-container", { timeout: 10000 });
	await wait(400);
	await page.locator(".start-page-new-note-btn").click({ button: "right" });
	await page.waitForSelector(".menu", { timeout: 5000 });
	await page.locator(".menu .menu-item").nth(1).click();
	await wait(600);
	const modalOpen = await page.evaluate(() => document.querySelectorAll(".modal-container").length);
	assert("capture menu item opens capture modal", modalOpen === 1, `modals=${modalOpen}`);
	await page.keyboard.press("Escape");
	await wait(300);

	// ---- d. 日记不重复创建 ----
	const dup = await page.evaluate((p) => window.app.vault.getMarkdownFiles().filter((f) => f.path === p).length, expectedPath);
	assert("daily note not duplicated", dup === 1, `count=${dup}`);

	// ---- cleanup：删除测试创建的日记并回主页 ----
	await page.evaluate((p) => {
		const f = window.app.vault.getAbstractFileByPath(p);
		if (f) window.app.vault.delete(f);
		const leaf = window.app.workspace.getLeavesOfType("markdown").find((l) => l.view.getState?.()["file"] === p);
		leaf?.detach();
	}, expectedPath);
	await wait(300);
	await page.evaluate(() => window.app.commands.executeCommandById("start-page:open-start-page"));
	await wait(300);

	return results;
};
