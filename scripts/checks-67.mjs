// #67 验证：笔记条目键盘可达（role/tabindex、Tab 聚焦、Enter/空格打开、不误触任意键搜索）
export default async (page) => {
	const wait = (ms) => new Promise((r) => setTimeout(r, ms));
	const results = [];
	const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });

	await page.waitForSelector(".start-page-container", { timeout: 10000 });
	await wait(500); // 等冒烟断言后的渲染稳定

	// ---- a. 结构：条目带 role=button + tabindex；假搜索框移出 Tab 序 ----
	const struct = await page.evaluate(() => {
		const items = [...document.querySelectorAll(".note-item")];
		return {
			total: items.length,
			ok: items.filter((el) => el.getAttribute("role") === "button" && el.getAttribute("tabindex") === "0").length,
			searchTabindex: document.querySelector(".search-box")?.getAttribute("tabindex"),
		};
	});
	assert("note items have role=button + tabindex=0", struct.total > 0 && struct.ok === struct.total, `${struct.ok}/${struct.total}`);
	assert("search box removed from tab order", struct.searchTabindex === "-1", `tabindex=${struct.searchTabindex}`);

	// ---- b. Tab 真实遍历可达条目（不再被搜索框 blur 弹飞）----
	await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
	let reached = false;
	for (let i = 0; i < 20 && !reached; i++) {
		await page.keyboard.press("Tab");
		reached = await page.evaluate(() => (document.activeElement)?.classList?.contains("note-item") ?? false);
	}
	assert("Tab traversal reaches a note item", reached, "");

	// ---- c. ↑/↓ 列表内导航 + 聚焦样式醒目 ----
	const arrowState = await page.evaluate(() => {
		const visible = [...document.querySelectorAll(".note-item")].filter((el) => el.offsetParent !== null);
		visible[1].focus();
		return visible.map((el) => el.getAttribute("data-note-path"));
	});
	await page.keyboard.press("ArrowDown");
	const afterDown = await page.evaluate(() => (document.activeElement)?.getAttribute("data-note-path"));
	await page.keyboard.press("ArrowUp");
	const afterUp = await page.evaluate(() => (document.activeElement)?.getAttribute("data-note-path"));
	assert(
		"ArrowDown/ArrowUp move focus within list",
		afterDown === arrowState[2] && afterUp === arrowState[1],
		`down=${afterDown} up=${afterUp}`,
	);
	await wait(450); // 条目有 transition:all，等聚焦轮廓过渡完成再取计算样式
	const focusStyle = await page.evaluate(() => {
		const el = document.activeElement;
		const s = window.getComputedStyle(el);
		return { outlineWidth: s.outlineWidth, outlineColor: s.outlineColor };
	});
	assert(
		"focused item has prominent outline",
		parseFloat(focusStyle.outlineWidth) > 0 && focusStyle.outlineColor !== "rgba(0, 0, 0, 0)",
		JSON.stringify(focusStyle),
	);

	// ---- c. Enter 打开笔记（真实按键）----
	const targetPath = await page.evaluate(() => document.activeElement?.getAttribute("data-note-path"));
	await page.keyboard.press("Enter");
	await wait(700);
	const afterEnter = await page.evaluate(() => window.app.workspace.getActiveFile()?.path ?? null);
	assert("Enter opens the note", afterEnter === targetPath, `target=${targetPath} active=${afterEnter}`);

	// ---- d. 回主页，空格打开笔记且不触发任意键搜索 ----
	await page.evaluate(() => window.app.commands.executeCommandById("start-page:open-start-page"));
	await page.waitForSelector(".start-page-container", { timeout: 10000 });
	await wait(400);
	const state = await page.evaluate(async () => {
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const item = document.querySelector(".recent-notes .note-item");
		const path = item.getAttribute("data-note-path");
		item.focus();
		item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
		await wait(700);
		return { path, active: window.app.workspace.getActiveFile()?.path ?? null, modals: document.querySelectorAll(".modal-container").length };
	});
	assert("Space opens note, no search modal", state.active === state.path && state.modals === 0, `active=${state.active} modals=${state.modals}`);

	// ---- e. 回归：容器聚焦时任意键搜索仍可用 ----
	await page.evaluate(() => window.app.commands.executeCommandById("start-page:open-start-page"));
	await page.waitForSelector(".start-page-container", { timeout: 10000 });
	await wait(400);
	const anyKey = await page.evaluate(async () => {
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const container = document.querySelector(".start-page-container");
		container.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }));
		await wait(400);
		return document.querySelectorAll(".modal-container").length;
	});
	assert("any-key search still works", anyKey > 0, "");
	await page.keyboard.press("Escape");

	return results;
};
