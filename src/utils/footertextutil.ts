import { t } from "@/i18n";
import StartPagePlugin from "@/main";
import { StartPageSettings } from "@/types";
import { getLanguage, requestUrl } from "obsidian";

const QUOTE_API_URL_EN = "https://zenquotes.io/api/random";
const QUOTE_API_URL_ZH = "https://v2.jinrishici.com/one.json?client=browser-sdk/1.2";

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

        try {
            let response = await requestUrl(QUOTE_API_URL_ZH,);

            if (response.status === 200) {
                let result = await response.json;
                let text = `${result.data.content} - ${result.data.origin.author}`;
                settings.todayRandomZhFooterText = `${today}|${text}`;
                plugin.saveSettings();
                return text;
            } else {
                console.log("Error fetching Chinese footer text:", response.status, response.text);
            }
        } catch (err) {
            console.log("Error fetching Chinese footer text:", err);
        }
        return t("default_footer_text");
    }

    static async getEnglishRandomFooterText(plugin: StartPagePlugin): Promise<string> {
        const settings: StartPageSettings = plugin.settings;
        const today: string = new Date().toISOString().slice(0, 10);
        if (settings.todayRandomEnFooterText && settings.todayRandomEnFooterText.startsWith(today)) {
            return settings.todayRandomEnFooterText.split("|")[1];
        }
        try {
            let response = await requestUrl(QUOTE_API_URL_EN);

            if (response.status === 200) {
                let result = await response.json;
                let text = `${result[0].q} - ${result[0].a}`;
                settings.todayRandomEnFooterText = `${today}|${text}`;
                plugin.saveSettings();
                return text;
            } else {
                console.log("Error fetching English footer text:", response.status, response.text);
            }
        } catch (err) {
            console.log("Error fetching English footer text:", err);
        }
        return t("default_footer_text");
    }
}