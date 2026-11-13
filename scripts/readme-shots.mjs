/**
 * README 截图流水线：临时 vault（测试 vault 副本 + 示例笔记）→ CDP 截图 → Screenshots/*.png
 *
 * 用法：node scripts/readme-shots.mjs [--no-build]
 *
 * 不触碰测试 vault 本体：内容写入 %TEMP%/obsidian-startpage-readme-vault。
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const args = process.argv.slice(2);
const DO_BUILD = !args.includes("--no-build");
const PORT = 9223;
const CDP_URL = `http://127.0.0.1:${PORT}`;

const OBSIDIAN_EXE =
	process.env.OBSIDIAN_EXE ?? path.join(process.env.LOCALAPPDATA ?? "", "Programs", "obsidian", "Obsidian.exe");
const TEST_VAULT = process.env.OBSIDIAN_TEST_VAULT ?? "D:\\Projects\\Personal\\Projects\\obsidian-startpage-testvault";
const SHOT_VAULT = path.join(process.env.TEMP ?? "C:\\Temp", "obsidian-startpage-readme-vault");
const CDP_PROFILE = path.join(process.env.TEMP ?? "C:\\Temp", "obsidian-cdp-profile");
const PLUGIN_ID = "start-page";
const SHOT_DIR = "Screenshots";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const DEMO_PINNED = [
	["Travel/A Taste of the World - Culinary Adventures Abroad", "Food is the fastest way into a culture. Three weeks of markets, family kitchens and roadside stalls in Oaxaca, Lisbon and Osaka."],
	["Travel/Beyond the Landmarks - Discovering Local Secrets", "Skip the queue for the tower. The best hours in any city are the ones nobody photographs: laundry lines, delivery alleys, the 6am bakery."],
	["Travel/Chasing Sunsets - A Journey Through Hidden Coastal Towns", "A slow drive down the coast, stopping wherever the road ends at water. Notes on tides, ferries and the small guesthouses worth returning to."],
	["Travel/From Dawn to Dusk - Capturing a City in 24 Hours", "One day, one city, one battery. What changes between the first tram and the last one — light, crowds, noise, and what people eat at 3am."],
	["Travel/Lost in the Streets - Exploring Old Cities Without a Map", "Deliberately getting lost is a skill. Turn off the map, follow the shadow line, and let the old town reveal its own shortcuts."],
	["Travel/Mountains, Markets, and Memories - Notes from My Travels", "Ten years of trail notes and market receipts, condensed into the routes and meals that were actually worth the detour."],
];

const DEMO_NOTES = [
	["Notes/Meeting Notes - Product Sync", "## Decisions\n- Ship the compact command bar first, measure drop-off in the first week.\n- Density toggle stays behind the settings panel.\n\n## Follow-ups\n- [ ] Check the empty-state copy\n- [ ] Confirm mobile fab position clears the status bar"],
	["Notes/Ideas Inbox", "- A weekly digest note that links every highlight from the past seven days\n- Keyboard-first capture modal\n- Tag suggestions from the last 30 days of notes"],
	["Notes/How I Take Notes", "Notes are only useful when they are re-read. I keep three layers: fleeting capture, weekly review, and one permanent note per idea that survived both."],
	["Projects/Weekly Review Template", "## Wins\n## What slowed me down\n## What I will drop next week\n## One thing to learn"],
	["Projects/Reading List 2027", "1. The Art of Doing Science and Engineering\n2. Thinking in Systems\n3. A Pattern Language\n4. The Timeless Way of Building"],
	["Projects/Startpage Redesign Notes", "The old layout explained itself with cards; the new one explains itself with hierarchy. Greeting and search share a line, actions collapse into chips, counts live inside the tab label."],
	["Notes/Weekly Review - 2026-11", "Most weeks look identical in retrospect. Write down the two decisions that actually changed something, then delete the rest of the review."],
	["Notes/Books Worth Re-reading", "Re-reading is how a book becomes a reference. These five have survived three passes: systems, writing, design, cities, and one novel."],
];

async function run(cmd, cwd) {
	const proc = spawn(cmd, { shell: true, cwd, stdio: "inherit" });
	const code = await new Promise((r) => proc.on("exit", r));
	if (code !== 0) throw new Error(`${cmd} exit=${code}`);
}

function daysAgo(n, hour = 21) {
	const d = new Date();
	d.setDate(d.getDate() - n);
	d.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
	return d;
}

async function seedNote(rel, body, mtime) {
	const file = path.join(SHOT_VAULT, `${rel}.md`);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, body, "utf8");
	await touch(file, mtime);
}

async function touch(file, mtime) {
	const { utimes } = await import("node:fs/promises");
	await utimes(file, mtime, mtime);
}

async function prepareVault() {
	if (existsSync(SHOT_VAULT)) await rm(SHOT_VAULT, { recursive: true, force: true });
	// 只继承测试 vault 的 Obsidian 配置（含插件启用状态），笔记内容全部重新生成
	await mkdir(SHOT_VAULT, { recursive: true });
	await cp(path.join(TEST_VAULT, ".obsidian"), path.join(SHOT_VAULT, ".obsidian"), { recursive: true });
	await rm(path.join(SHOT_VAULT, ".obsidian/plugins/hot-reload"), { recursive: true, force: true });
	await rm(path.join(SHOT_VAULT, ".obsidian/workspace.json"), { force: true });
	await rm(path.join(SHOT_VAULT, ".obsidian/workspace-mobile.json"), { force: true });

	const appearance = JSON.parse(await readFile(path.join(SHOT_VAULT, ".obsidian/appearance.json"), "utf8"));
	await writeFile(
		path.join(SHOT_VAULT, ".obsidian/appearance.json"),
		JSON.stringify({ ...appearance, theme: "moonstone", cssTheme: "", accentColor: "" }, null, 2),
	);

	const dataPath = path.join(SHOT_VAULT, ".obsidian/plugins/obsidian-startpage/data.json");
	const data = JSON.parse(await readFile(dataPath, "utf8"));
	await writeFile(
		dataPath,
		JSON.stringify(
			{
				...data,
				includeAllFilesInRecent: false,
				recentNotesLimit: 10,
				showTabs: true,
				showRecentSection: true,
				pinnedNotes: DEMO_PINNED.map(([rel]) => `${rel}.md`),
				useRandomFooterText: false,
				showCustomFooterText: true,
				customFooterText: "Notes are a conversation with your future self.",
				checkForUpdates: false,
			},
			null,
			2,
		),
	);

	// 置顶笔记时间刻意拉开，避免与最近列表重合
	for (let i = 0; i < DEMO_PINNED.length; i++) {
		const [rel, body] = DEMO_PINNED[i];
		await seedNote(rel, body, daysAgo(40 + i * 17, 18));
	}
	for (let i = 0; i < DEMO_NOTES.length; i++) {
		const [rel, body] = DEMO_NOTES[i];
		await seedNote(rel, body, daysAgo(1 + i * 3, 10 + i));
	}
	// 最近列表需要「今天 / 本周 / 更早」三段都有内容
	const dailyThoughts = [
		"Small note captured on the way out. One sentence is enough to remember why it mattered.\n\nFollow up when the week settles.",
		"The best ideas showed up between two meetings, not inside one. Keep the capture box within reach.",
		"Reread last week's notes before writing new ones. Half of the open questions already have answers.",
		"Delete the note that only exists because deleting felt risky. The vault should stay light.",
	];
	for (let i = 0; i < dailyThoughts.length; i++) {
		await seedNote(`Notes/Daily thought ${i + 1}`, dailyThoughts[i], daysAgo(0, 8 + i));
	}
	// 热力图需要一年里高低不一的活跃度；避开最近三周，免得挤掉手工写的最近笔记
	for (let i = 0; i < 260; i++) {
		const back = 21 + (i % 309);
		await seedNote(
			`Journal/${new Date(daysAgo(back)).toISOString().slice(0, 10)}${back > 32 ? "" : "-" + i}`,
			`# ${new Date(daysAgo(back)).toISOString().slice(0, 10)}\n\nWhat moved today, what stalled, what is worth keeping.\n`,
			daysAgo(back, 7 + (i % 12)),
		);
	}
	log(`vault prepared: ${SHOT_VAULT}`);
}

async function registerVault() {
	const cfgPath = path.join(CDP_PROFILE, "obsidian.json");
	const cfg = existsSync(cfgPath) ? JSON.parse(await readFile(cfgPath, "utf8")) : { vaults: {} };
	for (const id of Object.keys(cfg.vaults)) {
		if (cfg.vaults[id].path === SHOT_VAULT) delete cfg.vaults[id];
		else cfg.vaults[id].open = false;
	}
	cfg.vaults[randomBytes(8).toString("hex")] = { path: SHOT_VAULT, ts: Date.now(), open: true };
	await writeFile(cfgPath, JSON.stringify(cfg));
}

async function killObsidian() {
	await new Promise((r) => {
		const p = spawn(
			"powershell",
			["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"name='Obsidian.exe'\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"],
			{ stdio: "ignore" },
		);
		p.on("exit", r);
	});
	await sleep(2500);
}

async function cdpAlive() {
	try {
		return (await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(1500) })).ok;
	} catch {
		return false;
	}
}

async function ensureCdp() {
	if (await cdpAlive()) return;
	spawn(
		OBSIDIAN_EXE,
		[`--user-data-dir=${CDP_PROFILE.split(path.sep).join("/")}`, `--remote-debugging-port=${PORT}`, SHOT_VAULT.split(path.sep).join("/")],
		{ detached: true, stdio: "ignore" },
	).unref();
	for (let i = 0; i < 60 && !(await cdpAlive()); i++) await sleep(500);
	if (!(await cdpAlive())) throw new Error(`CDP 端口 ${PORT} 未就绪`);
	await sleep(6000);
}

async function getPage(browser, pred) {
	for (let i = 0; i < 40; i++) {
		for (const ctx of browser.contexts()) {
			const page = ctx.pages().find(pred);
			if (page) return page;
		}
		await sleep(500);
	}
	return null;
}

// 桌面端 devicePixelRatio=1 截出来是 1x，README 里缩放后发虚；强制 2x 出图
async function emulate(page, width, height, deviceScaleFactor = 2) {
	const session = await page.context().newCDPSession(page);
	await session.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile: false });
	return session;
}

// Playwright 的 locator.screenshot 走它自己的 viewport（1x/1.25x），只有 CDP 的 clip 截图会按 dpr 出像素
async function shotElement(page, session, selector, target) {
	const rect = await page.evaluate((sel) => {
		const r = document.querySelector(sel).getBoundingClientRect();
		return { x: r.left, y: r.top, width: r.width, height: r.height };
	}, selector);
	const shot = await session.send("Page.captureScreenshot", { format: "png", clip: { ...rect, scale: 1 } });
	await writeFile(target, Buffer.from(shot.data, "base64"));
}

async function main() {
	if (DO_BUILD) await run("npm run build", process.cwd());
	await prepareVault();
	await mkdir(SHOT_DIR, { recursive: true });

	// 同步构建产物到临时 vault，避免截到旧版本
	for (const f of ["main.js", "styles.css", "manifest.json"]) {
		await cp(path.join("dist", f), path.join(SHOT_VAULT, ".obsidian/plugins/obsidian-startpage", f));
	}

	await killObsidian();
	await registerVault();
	await ensureCdp();

	const browser = await chromium.connectOverCDP(CDP_URL);
	const page = await getPage(browser, (p) => p.url().startsWith("app://obsidian.md/index.html"));
	if (!page) throw new Error("未找到 vault 窗口");

	await page.setViewportSize({ width: 1600, height: 900 });
	const trust = page.locator("button", { hasText: /Trust author and enable plugins/ });
	if (await trust.count()) {
		await trust.first().click();
		await sleep(3000);
	}

	await page.evaluate(async (id) => {
		const pl = window.app.plugins;
		if (pl.plugins[id]) await pl.disablePlugin(id);
		await pl.enablePlugin(id);
		await window.app.commands.executeCommandById(`${id}:open-start-page`);
	}, PLUGIN_ID);
	await page.waitForSelector(".start-page-container", { timeout: 15000 });
	log(`vault open: ${await page.evaluate(() => window.app.vault.getName())}`);

	const shootPage = async (theme, mobile) => {
		const session = await emulate(page, mobile ? 390 : 1600, mobile ? 844 : 900);
		// 侧栏展开时会把页面挤窄，截图统一收起，桌面/移动得到一致的整页宽度
		await page.evaluate(() => {
			window.app.workspace.leftSplit.collapse();
			window.app.workspace.rightSplit.collapse();
		});
		await sleep(900);
		const target = path.join(SHOT_DIR, `startpage-${mobile ? "mobile" : "desktop"}-${theme}.png`);
		await shotElement(page, session, ".workspace-leaf.mod-active .start-page-container", target);
		log(`shot ${target}`);
	};

	const shootSettings = async (theme, mobile) => {
		await page.evaluate(async () => {
			await window.app.setting.open();
			await window.app.setting.openTabById("start-page");
		});
		await sleep(1200);
		// 1.15 起设置面板默认在独立窗口打开，需要截 popout 文档
		const pop = await getPage(browser, (p) => p !== page && p.url() === "about:blank");
		if (!pop) throw new Error("未找到设置弹窗");
		// 移动端设置面板比手机视口高，居中后会溢出上边界；给足高度让整块面板完整入镜
		const session = await emulate(pop, mobile ? 390 : 1000, mobile ? 1000 : 980);
		// 桌面端窄窗口不会切到移动端布局，用 Obsidian 自己的 is-mobile 样式类还原手机设置页外观
		await pop.evaluate((m) => {
			document.body.classList.toggle("is-mobile", m);
			document.body.classList.toggle("is-phone", m);
			// 去掉窗口标题栏：README 里只需设置面板本身，也避免暴露 vault 名
			document.querySelector(".titlebar")?.remove();
		}, mobile);
		await sleep(900);
		const target = path.join(SHOT_DIR, `setting-${mobile ? "mobile" : "desktop"}-${theme}.png`);
		// 设置面板的标题栏在 .modal 盒子之外（1.15 的 popout 布局），按元素裁会切掉返回箭头，整窗截图
		const shot = await session.send("Page.captureScreenshot", { format: "png" });
		await writeFile(target, Buffer.from(shot.data, "base64"));
		log(`shot ${target}`);
		await page.evaluate(() => window.app.setting.close());
		await sleep(800);
	};

	for (const [theme, obsidianTheme] of [["light", "moonstone"], ["dark", "obsidian"]]) {
		// 1.15 的 app.setTheme() 不接受参数，只按 vault 配置重算
		await page.evaluate((t) => {
			window.app.vault.setConfig("theme", t);
			window.app.setTheme();
		}, obsidianTheme);
		await sleep(1200);
		log(`theme=${theme} body=${await page.evaluate(() => document.body.className.includes("theme-dark") ? "dark" : "light")}`);
		await shootPage(theme, false);
		await shootSettings(theme, false);
		await shootPage(theme, true);
		await shootSettings(theme, true);
	}

	await page.evaluate(() => window.app.setTheme("moonstone"));
	await page.setViewportSize({ width: 1600, height: 900 });
	await browser.close();	// 临时 vault 与实例保留，方便手动复查截图现场；重复执行会重建
	log(`vault: ${SHOT_VAULT}`);
	log("done");
}

main().catch((e) => {
	console.error("SHOTS: ERROR —", e.message);
	process.exit(1);
});
