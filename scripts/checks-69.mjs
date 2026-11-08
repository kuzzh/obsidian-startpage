// #69 验证：#tag / folder: 令牌过滤（AND 组合）、命中高亮、Ctrl+Enter 新标签打开
export default async (page) => {
	const wait = (ms) => new Promise((r) => setTimeout(r, ms));
	const results = [];
	const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });

	await page.waitForSelector(".start-page-container", { timeout: 10000 });
	await wait(500);

	// 清理上次运行残留的弹窗，避免遮挡点击
	while ((await page.locator(".modal-container").count()) > 0) {
		await page.keyboard.press("Escape");
		await wait(300);
	}

	// ---- arrange：给 Noe/haha.md 加 frontmatter 标签并等索引更新 ----
	await page.evaluate(async () => {
		const file = window.app.vault.getAbstractFileByPath("Noe/haha.md");
		window.__e2e69orig = await window.app.vault.read(file);
		await window.app.vault.process(file, (data) => "---\ntags:\n  - e2e-tag\n---\n" + data);
	});
	await page.waitForFunction(() => {
		const f = window.app.vault.getAbstractFileByPath("Noe/haha.md");
		const fm = window.app.metadataCache.getFileCache(f)?.frontmatter;
		return Array.isArray(fm?.tags) && fm.tags.includes("e2e-tag");
	}, null, { timeout: 10000 });

	// ---- 打开搜索弹窗 ----
	await page.locator(".search-box").click();
	await page.waitForSelector(".my-search-modal", { timeout: 5000 });

	// ---- 语法提示行：三个 code 令牌 ----
	const hints = await page.evaluate(() =>
		[...(document.querySelectorAll(".search-syntax-hints code") ?? [])].map((el) => el.textContent),
	);
	assert(
		"syntax hints list tokens",
		hints.length === 3 && hints.join(",").includes("folder:") && hints.join(",").includes("#tag"),
		hints.join(" | "),
	);

	const input = page.locator(".my-search-modal input").first();
	await input.click();

	// ---- a. #tag 过滤 ----
	await page.keyboard.type("#e2e-tag");
	await page.waitForFunction(() => document.querySelectorAll(".search-result-item").length === 1, null, { timeout: 5000 });
	const tagResult = await page.evaluate(() => document.querySelector(".search-result-item")?.getAttribute("title"));
	assert("tag filter narrows to tagged note", tagResult === "haha", `got ${tagResult}`);

	// ---- b. folder: 过滤 ----
	await input.fill("");
	await page.keyboard.type("folder:noe");
	await wait(400);
	const folderResults = await page.evaluate(() =>
		[...document.querySelectorAll(".search-result-item")].map((el) => el.getAttribute("title")),
	);
	const expectedFolder = await page.evaluate(() =>
		window.app.vault.getMarkdownFiles().filter((f) => f.path.toLowerCase().startsWith("noe/")).length,
	);
	assert(
		"folder filter matches folder contents",
		folderResults.length === expectedFolder && folderResults.includes("haha"),
		`got ${folderResults.length}, expect ${expectedFolder}`,
	);

	// ---- c. 令牌组合 AND ----
	await input.fill("");
	await page.keyboard.type("folder:noe #e2e-tag");
	await wait(400);
	const combined = await page.evaluate(() =>
		[...document.querySelectorAll(".search-result-item")].map((el) => el.getAttribute("title")),
	);
	assert("combined tokens AND filter", combined.length === 1 && combined[0] === "haha", JSON.stringify(combined));

	// ---- d. 命中高亮 ----
	await input.fill("");
	await page.keyboard.type("note");
	await wait(400);
	const hl = await page.evaluate(() => {
		const item = document.querySelector(".search-result-item");
		const name = item?.querySelector(".search-result-item-file-name")?.textContent ?? "";
		const marks = [...(item?.querySelectorAll(".search-result-item-highlight") ?? [])].map((el) => el.textContent);
		return { name, marks };
	});
	assert(
		"highlight marks fall inside file name",
		hl.marks.length > 0 &&
			hl.marks.every((m) => hl.name.toLowerCase().includes(m.toLowerCase())) &&
			hl.marks.join("").length <= hl.name.length,
		JSON.stringify(hl),
	);

	// ---- e. Ctrl+Enter 强制新标签打开 ----
	const before = await page.evaluate(() => ({
		leaves: window.app.workspace.getLeavesOfType("markdown").length,
		startPage: window.app.workspace.getLeavesOfType("start-page-view").length,
	}));
	const firstResult = await page.evaluate(() => document.querySelector(".search-result-item")?.getAttribute("title"));
	await page.keyboard.press("Control+Enter");
	await wait(700);
	const after = await page.evaluate(() => ({
		active: window.app.workspace.getActiveFile()?.basename ?? null,
		leaves: window.app.workspace.getLeavesOfType("markdown").length,
		startPage: window.app.workspace.getLeavesOfType("start-page-view").length,
		modals: document.querySelectorAll(".my-search-modal").length,
	}));
	assert(
		"Ctrl+Enter opens result in new tab",
		after.active === firstResult && after.leaves === before.leaves + 1 && after.startPage === before.startPage && after.modals === 0,
		`active=${after.active} leaves ${before.leaves}->${after.leaves}`,
	);

	// ---- cleanup：还原 haha.md、关闭新开的 leaf、回主页 ----
	await page.evaluate(async () => {
		const file = window.app.vault.getAbstractFileByPath("Noe/haha.md");
		await window.app.vault.process(file, () => window.__e2e69orig);
		delete window.__e2e69orig;
	});
	await wait(500);
	await page.evaluate(() => {
		const target = window.app.workspace.getActiveFile();
		const leaf = window.app.workspace
			.getLeavesOfType("markdown")
			.find((l) => l.view.getState?.()["file"] === target?.path);
		leaf?.detach();
	});
	await wait(300);
	await page.evaluate(() => window.app.commands.executeCommandById("start-page:open-start-page"));
	await wait(400);

	return results;
};
