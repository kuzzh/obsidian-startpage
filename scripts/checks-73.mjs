// #73 验证：紧凑三行式条目（摘要/时间·路径/无图标）、分隔线、缩略图、扁平样式
export default async (page) => {
	// 鼠标停在列表上会触发 :hover 背景，干扰扁平样式断言
	await page.mouse.move(5, 5);
	const results = await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });
		const view = window.app.workspace.getLeavesOfType("start-page-view")[0].view;

		await wait(500);

		// ---- arrange：给 Note 2 写入可预测内容，给 Note 1 挂一张内嵌图片 ----
		const note2 = window.app.vault.getAbstractFileByPath("Notes/Note 2.md");
		const note1 = window.app.vault.getAbstractFileByPath("Notes/Note 1.md");
		const orig2 = await window.app.vault.read(note2);
		const orig1 = await window.app.vault.read(note1);
		await window.app.vault.process(note2, () => "# Heading\n\nThis is preview **bold** line #sometag\nsecond paragraph joins the preview\n");
		// 1x1 PNG（幂等：上次中断的运行可能残留）
		const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		const stalePng = window.app.vault.getAbstractFileByPath("e2e73.png");
		if (stalePng) await window.app.vault.delete(stalePng);
		await window.app.vault.createBinary("e2e73.png", bytes);
		await window.app.vault.process(note1, (data) => data + "\n![[e2e73.png]]\n");
		// 等 metadataCache 解析出 embed
		await new Promise((resolve) => {
			let tries = 0;
			const poll = () => {
				const cache = window.app.metadataCache.getFileCache(note1);
				if (cache?.embeds?.length || tries++ > 20) resolve();
				else setTimeout(poll, 250);
			};
			poll();
		});
		await view.renderContent();
		await wait(1200); // 摘要为渲染后异步填充

		// ---- a. 结构：三行式（标题/摘要/时间·路径·类型）、无图标无扩展名徽标、行间分隔线 ----
		// 锚定 Note 2：测试 vault 会被外部同步还原杂散文件，首个条目内容不稳定
		const item = document.querySelector('.recent-notes .note-item[data-note-path="Notes/Note 2.md"]');
		const struct = {
			titleRow: !!item?.querySelector(".note-title-row .note-title"),
			preview: !!item?.querySelector(".note-preview"),
			metaDate: item?.querySelector(".note-meta-row .note-date")?.textContent ?? "",
			metaFolder: !!item?.querySelector(".note-meta-row .note-folder"),
			metaType: item?.querySelector(".note-meta-row .note-type")?.textContent ?? "",
			separator: item?.querySelector(".note-meta-row .note-meta-separator")?.textContent ?? "",
			iconGone: !item?.querySelector(".note-icon"),
			extGone: !item?.querySelector(".note-ext"),
			thumbInNote1: !!document.querySelector('.recent-notes .note-item[data-note-path="Notes/Note 1.md"] .note-thumb img'),
		};
		assert(
			"compact three-row structure",
			struct.titleRow && struct.preview && struct.metaDate && struct.metaFolder && struct.metaType === "MD" && struct.separator === "·" && struct.iconGone && struct.extGone,
			JSON.stringify(struct),
		);
		const divider = window.getComputedStyle(item).borderBottomWidth;
		assert("row divider present", parseFloat(divider) > 0, divider);

		// ---- b. 摘要提取：跳过标题、剥离标记与标签 ----
		const previewText = document.querySelector(
			'.recent-notes .note-item[data-note-path="Notes/Note 2.md"] .note-preview',
		)?.textContent;
		assert(
			"preview text extracted, lines joined with space",
			previewText === "This is preview bold line second paragraph joins the preview",
			`got "${previewText}"`,
		);

		// ---- c. 缩略图 ----
		assert("thumbnail rendered for embedded image", struct.thumbInNote1, "");
		const noThumb = document.querySelector('.recent-notes .note-item[data-note-path="Notes/Note 2.md"] .note-thumb');
		assert("no placeholder thumb for imageless note", !noThumb, "");

		// ---- d. 行高与扁平样式（量无缩略图条目；两行摘要预算 ~89css，1.1 缩放）----
		const plainItem = document.querySelector('.recent-notes .note-item[data-note-path="Notes/Note 2.md"]');
		const rect = plainItem.getBoundingClientRect();
		const bg = window.getComputedStyle(item).backgroundColor;
		const clamped = window.getComputedStyle(plainItem.querySelector(".note-preview")).webkitLineClamp;
		assert("preview clamped to 2 lines", clamped === "2", `line-clamp=${clamped}`);
		assert("row height compact (<=105px)", rect.height > 0 && rect.height <= 105, `h=${Math.round(rect.height)}`);
		assert("flat style (transparent background)", bg === "rgba(0, 0, 0, 0)", bg);

		// ---- e. 变体 C 结构：命令条 + chips 行 + 无 FAB ----
		const cStruct = {
			cmdBar: !!document.querySelector(".command-bar .search-box"),
			kbd: document.querySelectorAll(".command-bar .command-kbd").length,
			chips: [...document.querySelectorAll(".chip-row .chip")].map((el) => el.textContent.trim()),
			primaryChip: !!document.querySelector(".chip-row .chip-primary"),
			fabGone: !document.querySelector(".start-page-new-note-btn"),
			densityClass: [...document.querySelector(".main-content").classList].find((c) => c.startsWith("density-")),
		};
		assert(
			"command header with chips, no FAB",
			cStruct.cmdBar && cStruct.kbd >= 2 && cStruct.primaryChip && cStruct.chips.length >= 1 && cStruct.fabGone && cStruct.densityClass === "density-comfortable",
			JSON.stringify(cStruct),
		);

		// ---- f. 密度切换：紧凑档隐藏摘要与元信息行 ----
		plugin.settings.listDensity = "compact";
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);
		const compactItem = document.querySelector('.recent-notes .note-item[data-note-path="Notes/Note 2.md"]');
		const compactState = {
			previewHidden: window.getComputedStyle(compactItem.querySelector(".note-preview")).display === "none",
			metaHidden: window.getComputedStyle(compactItem.querySelector(".note-meta-row")).display === "none",
		};
		assert("compact density hides preview and meta", compactState.previewHidden && compactState.metaHidden, JSON.stringify(compactState));
		plugin.settings.listDensity = "comfortable";
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);

		// ---- cleanup（笔记内容与临时图片；移动端断言在 evaluate 外进行）----
		await window.app.vault.process(note2, () => orig2);
		await window.app.vault.process(note1, () => orig1);
		const png = window.app.vault.getAbstractFileByPath("e2e73.png");
		if (png) await window.app.vault.delete(png);
		await wait(400);
		await view.renderContent();
		await wait(300);

		return results;
	});

	// ---- g. 移动端：文字 chips 隐藏、＋ 按钮显示、热力图隐藏（需真实视口切换）----
	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForTimeout(400);
	const mobile = await page.evaluate(() => {
		const style = (sel) => {
			const el = document.querySelector(sel);
			return el ? window.getComputedStyle(el).display : null;
		};
		const fab = document.querySelector(".chip-fab");
		const fabRect = fab ? fab.getBoundingClientRect() : null;
		return {
			chipHidden: style(".chip-row .chip-primary") === "none",
			fabShown: style(".chip-fab") === "flex",
			fabFixed: fab ? window.getComputedStyle(fab).position === "fixed" : false,
			fabBottomRight:
				!!fabRect &&
				fabRect.right > window.innerWidth * 0.75 &&
				fabRect.bottom > window.innerHeight * 0.75,
			heatHidden: style(".chip-row .activity-grid") === "none",
		};
	});
	results.push({
		name: "mobile: floating fab bottom-right, chips replaced, heatmap hidden",
		pass: mobile.chipHidden && mobile.fabShown && mobile.fabFixed && mobile.fabBottomRight && mobile.heatHidden,
		detail: JSON.stringify(mobile),
	});
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.waitForTimeout(400);

	return results;
};
