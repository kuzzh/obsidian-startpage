/**
 * UI 验证流水线：构建 → 同步测试 vault → CDP 断言 → 元素截图 → PASS/FAIL
 *
 * 用法：
 *   node scripts/verify.mjs                     # 全流程
 *   node scripts/verify.mjs --no-build          # 跳过构建（仅同步+验证）
 *   node scripts/verify.mjs --checks my.mjs     # 追加自定义断言
 *
 * 自定义断言文件格式（default export）：
 *   export default async (page) => [{ name: "...", pass: true, detail: "..." }]
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const OPT = (flag) => {
	const i = args.indexOf(flag);
	return i >= 0 ? (args[i + 1]?.startsWith("--") ? true : args[i + 1]) : args.includes(flag);
};
const DO_BUILD = !args.includes("--no-build");
const CHECKS_FILE = OPT("--checks");
const PORT = 9223;
const CDP_URL = `http://127.0.0.1:${PORT}`;

// 本地环境信息一律从环境变量/标准位置推导，禁止硬编码用户名等个人信息入库
const OBSIDIAN_EXE =
	process.env.OBSIDIAN_EXE ?? path.join(process.env.LOCALAPPDATA ?? "", "Programs", "obsidian", "Obsidian.exe");
const TEST_VAULT = process.env.OBSIDIAN_TEST_VAULT ?? "D:\\Projects\\Personal\\Projects\\obsidian-startpage-testvault";
const CDP_PROFILE = path.join(process.env.TEMP ?? "C:\\Temp", "obsidian-cdp-profile");
const PLUGIN_ID = "start-page";
const SHOT_PATH = "dist/verify-latest.png";

const results = [];
const t0 = Date.now();
const record = (name, pass, detail = "") => {
	results.push({ name, pass, detail });
	console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpAlive() {
	try {
		const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(1500) });
		return res.ok;
	} catch {
		return false;
	}
}

async function waitForCdp(timeoutMs = 30000) {
	const t0 = Date.now();
	while (Date.now() - t0 < timeoutMs) {
		if (await cdpAlive()) return true;
		await sleep(500);
	}
	return false;
}

async function ensureCdpInstance() {
	if (await cdpAlive()) return;
	console.log(`CDP 实例未运行，启动：port ${PORT}`);
	spawn(OBSIDIAN_EXE, [`--user-data-dir=${CDP_PROFILE}`, `--remote-debugging-port=${PORT}`, TEST_VAULT], {
		detached: true,
		stdio: "ignore",
	}).unref();
	if (!(await waitForCdp())) throw new Error(`CDP 端口 ${PORT} 未就绪（若有残留 Obsidian 实例占用端口，请先结束它们）`);
	await sleep(3000);
}

async function getAppPage(browser) {
	// connectOverCDP 后 pages 列表可能尚未就绪，短暂重试
	for (let i = 0; i < 20; i++) {
		for (const ctx of browser.contexts()) {
			const page = ctx.pages().find((p) => p.url().startsWith("app://obsidian.md/index.html"));
			if (page) return page;
		}
		await sleep(500);
	}
	return null;
}

async function main() {
	// ---- 1. 构建 ----
	if (DO_BUILD) {
		console.log("== 构建 ==");
		// Node 20+ 出于安全限制禁止直接 spawn .cmd，必须走 shell
		const proc = spawn("npm run build", { shell: true, stdio: "inherit" });
		const code = await new Promise((r) => proc.on("exit", r));
		record("build (tsc + esbuild)", code === 0, `exit=${code}`);
		if (code !== 0) return finish();
	} else {
		record("build", true, "skipped (--no-build)");
	}

	// ---- 2. 同步到测试 vault ----
	const distFiles = ["main.js", "styles.css", "manifest.json"].map((f) => [`dist/${f}`, f]);
	try {
		for (const [from, to] of distFiles) await cp(from, path.join(TEST_VAULT, ".obsidian/plugins", "obsidian-startpage", to));
		record("sync to test vault", true);
	} catch (e) {
		record("sync to test vault", false, e.message);
		return finish();
	}

	// Hot Reload 会在同步后自行重载插件并 detach 启动页 leaf，
	// 先等它完成，再执行后续手动 reload，避免竞态导致断言期间 leaf 消失
	await sleep(2500);

	// ---- 3. CDP 实例 ----
	await ensureCdpInstance();
	const browser = await chromium.connectOverCDP(CDP_URL);
	const page = await getAppPage(browser);
	if (!page) {
		record("cdp vault window", false, "未找到 app://obsidian.md/index.html 目标（vault 未打开，请检查 CDP 实例）");
		await browser.close();
		return finish();
	}

	// 首次打开 vault 会出现信任提示，CDP 直接点击即可
	const trustBtn = page.locator("button", { hasText: /Trust author and enable plugins/ });
	if (await trustBtn.count()) {
		await trustBtn.first().click();
		await sleep(3000);
	}

	// ---- 4. 强制重载插件 ----
	// Hot Reload 的触发时机不可控，同步后主动 reload 保证断言跑在新构建上
	try {
		await page.evaluate(async (id) => {
			const pl = window.app.plugins;
			if (pl.plugins[id]) await pl.disablePlugin(id);
			await pl.enablePlugin(id);
		}, PLUGIN_ID);
		await sleep(300);
		await page.evaluate((id) => window.app.commands.executeCommandById(`${id}:open-start-page`), PLUGIN_ID);
		await page.waitForSelector(".start-page-container", { timeout: 10000 });
		record("plugin reload + start page open", true);
	} catch (e) {
		record("plugin reload + start page open", false, e.message.split("\n")[0]);
		return finish();
	}

	// ---- 5. 默认冒烟断言 ----
	const smoke = await page.evaluate((id) => {
		const q = (s) => document.querySelector(s);
		return {
			vault: window.app.vault.getName(),
			pluginEnabled: !!window.app.plugins.plugins[id],
			container: !!q(".start-page-container"),
			statCards: document.querySelectorAll(".stat-card").length,
			recentItems: document.querySelectorAll(".recent-notes .note-item").length,
			emptyState: q(".notes-list-empty")?.textContent ?? null,
			pinnedBadge: q(".note-count-badge")?.textContent ?? null,
		};
	}, PLUGIN_ID);

	record("plugin enabled", smoke.pluginEnabled, `vault=${smoke.vault}`);
	record("start page container rendered", smoke.container);
	record("stat cards present (3)", smoke.statCards === 3, `got ${smoke.statCards}`);
	record("recent notes list rendered", smoke.recentItems > 0, `${smoke.recentItems} items`);
	if (smoke.emptyState !== null) {
		record("pinned empty state hint", smoke.emptyState.length > 0, smoke.emptyState);
	}

	// ---- 6. 自定义断言 ----
	if (CHECKS_FILE && CHECKS_FILE !== true) {
		const mod = await import(pathToFileURL(path.resolve(CHECKS_FILE)).href);
		const checks = await mod.default(page);
		for (const c of checks) record(c.name, c.pass, c.detail ?? "");
	}

	// ---- 7. 元素截图 ----
	try {
		await mkdir(path.dirname(SHOT_PATH), { recursive: true });
		await page.locator(".workspace-leaf.mod-active .start-page-container").screenshot({ path: SHOT_PATH });
		record("element screenshot", true, SHOT_PATH);
	} catch (e) {
		// 后台标签不可见时改用整页截图兜底
		await page.screenshot({ path: SHOT_PATH });
		record("element screenshot", true, `${SHOT_PATH} (full page fallback)`);
	}

	await browser.close();
	finish();
}

function finish() {
	const failed = results.filter((r) => !r.pass);
	console.log("\n================================");
	console.log(`VERIFY: ${failed.length === 0 ? "PASS" : "FAIL"}  (${results.length - failed.length}/${results.length}, 耗时 ${Date.now() - t0}ms)`);
	if (existsSync(SHOT_PATH)) console.log(`截图: ${SHOT_PATH}`);
	process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error("VERIFY: ERROR —", e.message);
	process.exit(1);
});
