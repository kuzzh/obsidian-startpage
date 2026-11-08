// #66 验证：页脚随机引言的缓存优先 + 离线走本地降级池 + 降级结果不入今日缓存
// 注意：renderContent 本身会异步取词，操作前必须等它落定，否则与刷新按钮产生竞态
export default async (page) => {
	return await page.evaluate(async () => {
		const plugin = window.app.plugins.plugins["start-page"];
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		const results = [];
		const assert = (name, pass, detail) => results.push({ name, pass, detail: String(detail ?? "") });
		const view = window.app.workspace.getLeavesOfType("start-page-view")[0].view;
		const footerText = () => document.querySelector(".footer p")?.textContent ?? "";

		await wait(500);

		// ---- arrange：开启随机引言 ----
		const orig = {
			show: plugin.settings.showCustomFooterText,
			random: plugin.settings.useRandomFooterText,
			en: plugin.settings.todayRandomEnFooterText,
			zh: plugin.settings.todayRandomZhFooterText,
		};
		plugin.settings.showCustomFooterText = true;
		plugin.settings.useRandomFooterText = true;

		// ---- a. 今日缓存优先：命中缓存时直接展示，不请求 ----
		const today = new Date().toISOString().slice(0, 10);
		plugin.settings.todayRandomEnFooterText = `${today}|Cached quote sentinel`;
		await plugin.saveSettings();
		await view.renderContent();
		await wait(400);
		assert("today cache renders first", footerText() === "Cached quote sentinel", footerText());

		// ---- b. 清缓存 + 模拟离线 → 降级池引言（" - " 署名格式，区别于默认文案/加载态）----
		plugin.settings.todayRandomEnFooterText = "";
		await plugin.saveSettings();
		await view.renderContent();
		await wait(1500); // 等 render 自带的异步取词落定，避免竞态覆盖断言结果
		const onLineDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
		Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
		document.getElementById("refresh-footer-text")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await wait(600);
		const fallbackText = footerText();
		assert(
			"offline fallback quote from pool",
			fallbackText.includes(" - ") && fallbackText !== "Cached quote sentinel",
			fallbackText,
		);
		assert(
			"fallback not persisted into today cache",
			plugin.settings.todayRandomEnFooterText === "",
			plugin.settings.todayRandomEnFooterText,
		);
		delete navigator.onLine;
		if (onLineDesc) Object.defineProperty(Navigator.prototype, "onLine", onLineDesc);

		// ---- c. 恢复在线后刷新 → 重新走 API（轮询等加载态结束）----
		document.getElementById("refresh-footer-text")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		let onlineText = "";
		for (let i = 0; i < 20; i++) {
			await wait(500);
			onlineText = footerText();
			if (onlineText && !onlineText.includes("Loading")) break;
		}
		assert("online refresh fetches API quote again", onlineText.length > 0 && !onlineText.includes("Loading"), onlineText);

		// ---- cleanup ----
		plugin.settings.showCustomFooterText = orig.show;
		plugin.settings.useRandomFooterText = orig.random;
		plugin.settings.todayRandomEnFooterText = orig.en;
		plugin.settings.todayRandomZhFooterText = orig.zh;
		await plugin.saveSettings();
		await view.renderContent();
		await wait(300);

		return results;
	});
};
