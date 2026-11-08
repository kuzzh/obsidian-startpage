// #63 验证：统计卡点击路由（总笔记→搜索、今日编辑→下钻弹窗、总大小→无动作）
export default async (page) => {
	return await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });
		const esc = () => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		const modalCount = (sel) => document.querySelectorAll(sel).length;

		await wait(500); // 等冒烟断言后的渲染稳定

		const cards = document.querySelectorAll(".stat-card");
		assert("3 stat cards", cards.length === 3, `got ${cards.length}`);

		// ---- a. 总大小卡：无动作、不可点样式 ----
		assert("total-size card is static", cards[2].classList.contains("static"), "");
		cards[2].click();
		await wait(300);
		assert("total-size click opens nothing", modalCount(".modal-container") === 0, "");

		// ---- b. 今日编辑卡：下钻弹窗，条目数与卡面数字一致 ----
		const todayCount = parseInt(cards[1].querySelector(".stat-number").textContent, 10);
		cards[1].click();
		await wait(400);
		const drillOpen = modalCount(".my-today-edited-modal") === 1;
		assert("today-edited card opens drill-down modal", drillOpen, "");
		if (drillOpen) {
			const items = document.querySelectorAll(".today-edited-item").length;
			const emptyShown = !!document.querySelector(".today-edited-empty");
			assert(
				"drill-down count matches stat number",
				todayCount === 0 ? emptyShown : items === todayCount,
				`stat=${todayCount} items=${items} empty=${emptyShown}`,
			);
			// 点击首条 → 打开笔记且弹窗关闭
			document.querySelector(".today-edited-item")?.click();
			await wait(600);
			const activeFile = window.app.workspace.getActiveFile()?.path ?? null;
			assert("drill-down click opens note", modalCount(".my-today-edited-modal") === 0 && !!activeFile, `file=${activeFile}`);
			await window.app.commands.executeCommandById("start-page:open-start-page");
			await wait(500);
		}

		// ---- c. 总笔记卡：保持打开搜索弹窗 ----
		document.querySelectorAll(".stat-card")[0].click();
		await wait(400);
		assert("total-notes card opens search modal", modalCount(".my-search-modal") === 1, "");
		esc();
		await wait(300);

		return results;
	});
};
