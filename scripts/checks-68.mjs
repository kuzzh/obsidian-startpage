// #68 验证：最近列表按 今天/本周/更早 分段，段序与条目归属和 mtime 规则一致
export default async (page) => {
	return await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });

		await wait(500);

		const list = document.querySelector(".recent-notes .notes-list");
		const children = [...list.children];
		const titles = children.filter((el) => el.classList.contains("notes-group-title")).map((el) => el.textContent.trim());
		const items = children.filter((el) => el.classList.contains("note-item"));

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

		const actual = children.map((el) =>
			el.classList.contains("notes-group-title") ? el.textContent.trim() : el.getAttribute("data-note-path"),
		);
		assert(
			"recent list grouped by time segments",
			JSON.stringify(actual) === JSON.stringify(expected),
			`titles=${titles.join("|")} items=${items.length}`,
		);
		assert(
			"segment order today -> week -> earlier",
			JSON.stringify(titles) === JSON.stringify(titleTexts.filter((_, i) => buckets[i].length > 0)),
			titles.join("|"),
		);

		return results;
	});
};
