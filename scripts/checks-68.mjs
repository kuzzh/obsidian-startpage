// #68 验证：最近列表按 今天/本周/更早 分段；首行「最近 · 今天」带数量下拉
export default async (page) => {
	return await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });

		await wait(500);

		const list = document.querySelector(".recent-notes .notes-list");
		const children = [...list.children];
		const titleEls = children.filter((el) => el.classList.contains("notes-group-title"));
		const labels = titleEls.map((el) => el.querySelector(".notes-group-label")?.textContent.trim() ?? "");
		const items = children.filter((el) => el.classList.contains("note-item"));
		// 首行前缀「最近 · 」（最近列表合并后的样式），比较段名时剥掉前缀
		const normalizeTitle = (label) => (label.includes(" · ") ? label.split(" · ").pop() : label);

		// 按与实现相同的规则推导期望序列
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		const mtimes = new Map(
			window.app.vault.getMarkdownFiles().map((f) => [f.path, f.stat.mtime]),
		);
		const expected = [];
		const buckets = [[], [], []];
		for (const el of children) {
			if (!el.classList.contains("note-item")) continue;
			const path = el.getAttribute("data-note-path");
			const mtime = mtimes.get(path);
			if (mtime >= todayStart.getTime()) buckets[0].push(path);
			else if (mtime >= weekAgo) buckets[1].push(path);
			else buckets[2].push(path);
		}
		const titleTexts = ["Today", "This week", "Earlier"];
		buckets.forEach((bucket, i) => {
			if (bucket.length > 0) expected.push(titleTexts[i]);
			expected.push(...bucket);
		});

		const actual = children.map((el) => {
			if (!el.classList.contains("notes-group-title")) return el.getAttribute("data-note-path");
			return normalizeTitle(el.querySelector(".notes-group-label")?.textContent.trim() ?? "");
		});
		assert(
			"recent list grouped by time segments",
			JSON.stringify(actual) === JSON.stringify(expected),
			`labels=${labels.join("|")} items=${items.length}`,
		);
		assert(
			"segment order today -> week -> earlier",
			JSON.stringify(labels.map(normalizeTitle)) === JSON.stringify(titleTexts.filter((_, i) => buckets[i].length > 0)),
			labels.join("|"),
		);
		assert(
			"first group row carries recent prefix and count dropdown",
			labels.length > 0 && labels[0].includes(" · ") && !!titleEls[0].querySelector("select"),
			`first=${labels[0] ?? "missing"}`,
		);

		return results;
	});
};
