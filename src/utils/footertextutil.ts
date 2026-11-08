import { t } from "@/i18n";
import StartPagePlugin from "@/main";
import { StartPageSettings } from "@/types";
import { getLanguage, requestUrl } from "obsidian";

const QUOTE_API_URL_EN = "https://zenquotes.io/api/random";
const QUOTE_API_URL_ZH = "https://v2.jinrishici.com/one.json?client=browser-sdk/1.2";

// API 失败或离线时的本地降级池（公版内容），避免随机引言功能在离线时完全失效
const FALLBACK_QUOTES_ZH = [
	"学而时习之，不亦说乎 - 孔子",
	"路漫漫其修远兮，吾将上下而求索 - 屈原",
	"千里之行，始于足下 - 老子",
	"知之者不如好之者，好之者不如乐之者 - 孔子",
	"不积跬步，无以至千里 - 荀子",
	"三人行，必有我师焉 - 孔子",
	"生于忧患，死于安乐 - 孟子",
	"人固有一死，或重于泰山，或轻于鸿毛 - 司马迁",
	"博学之，审问之，慎思之，明辨之，笃行之 - 《中庸》",
	"业精于勤，荒于嬉 - 韩愈",
];
const FALLBACK_QUOTES_EN = [
	"The only true wisdom is in knowing you know nothing - Socrates",
	"It does not matter how slowly you go as long as you do not stop - Confucius",
	"The journey of a thousand miles begins with one step - Lao Tzu",
	"What we think, we become - Buddha",
	"Well done is better than well said - Benjamin Franklin",
	"Lost time is never found again - Benjamin Franklin",
	"He who has a why to live can bear almost any how - Friedrich Nietzsche",
	"The best way out is always through - Robert Frost",
	"We suffer more often in imagination than in reality - Seneca the Younger",
	"Quality is not an act, it is a habit - Aristotle",
];

export default class FooterTextUtil {
    static async getFooterText(plugin: StartPagePlugin): Promise<string> {
        const settings: StartPageSettings = plugin.settings;
        if (!settings.showCustomFooterText) {
            return t("default_footer_text");
        }
        if (!settings.useRandomFooterText) {
            return settings.customFooterText || t("default_footer_text");
        }
        const obsidianLang = getLanguage() || "en";
        if (obsidianLang === "zh") {
            return await FooterTextUtil.getChineseRandomFooterText(plugin);
        } else {
            return await FooterTextUtil.getEnglishRandomFooterText(plugin);
        }
    }

    static async getChineseRandomFooterText(plugin: StartPagePlugin): Promise<string> {
        const settings: StartPageSettings = plugin.settings;

        const today: string = new Date().toISOString().slice(0, 10);

        if (settings.todayRandomZhFooterText && settings.todayRandomZhFooterText.startsWith(today)) {
            return settings.todayRandomZhFooterText.split("|")[1];
        }

        // 离线时跳过注定失败的请求，直接走本地降级池
        if (!navigator.onLine) {
            return FooterTextUtil.pickFallbackQuote("zh");
        }

        try {
            const response = await requestUrl(QUOTE_API_URL_ZH,);

            if (response.status === 200) {
                const result = await response.json;
                const text = `${result.data.content} - ${result.data.origin.author}`;
                settings.todayRandomZhFooterText = `${today}|${text}`;
                plugin.saveSettings();
                return text;
            } else {
                console.log("Error fetching Chinese footer text:", response.status, response.text);
            }
        } catch (err) {
            console.log("Error fetching Chinese footer text:", err);
        }
        return FooterTextUtil.pickFallbackQuote("zh");
    }

    static async getEnglishRandomFooterText(plugin: StartPagePlugin): Promise<string> {
        const settings: StartPageSettings = plugin.settings;
        const today: string = new Date().toISOString().slice(0, 10);
        if (settings.todayRandomEnFooterText && settings.todayRandomEnFooterText.startsWith(today)) {
            return settings.todayRandomEnFooterText.split("|")[1];
        }
        if (!navigator.onLine) {
            return FooterTextUtil.pickFallbackQuote("en");
        }
        try {
            const response = await requestUrl(QUOTE_API_URL_EN);

            if (response.status === 200) {
                const result = await response.json;
                const text = `${result[0].q} - ${result[0].a}`;
                settings.todayRandomEnFooterText = `${today}|${text}`;
                plugin.saveSettings();
                return text;
            } else {
                console.log("Error fetching English footer text:", response.status, response.text);
            }
        } catch (err) {
            console.log("Error fetching English footer text:", err);
        }
        return FooterTextUtil.pickFallbackQuote("en");
    }

    static pickFallbackQuote(lang: "zh" | "en"): string {
        const pool = lang === "zh" ? FALLBACK_QUOTES_ZH : FALLBACK_QUOTES_EN;
        // 均匀随机取一条；不入今日缓存，网络恢复后下次刷新即回到在线引言
        return pool[Math.floor(Math.random() * pool.length)];
    }
}
