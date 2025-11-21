import { t } from "@/i18n";
import StartPagePlugin from "@/main";
import { StartPageSettings } from "@/types";
import { getLanguage } from "obsidian";

const QUOTE_API_URL_EN = "http://api.quotable.io/random";
const QUOTE_API_URL_ZH = "https://v2.jinrishici.com/one.json?client=browser-sdk/1.2";

export default class FooterTextUtil {
    static async getFooterText(plugin: StartPagePlugin): Promise<string> {
        const settings: StartPageSettings = plugin.settings;
        // 如果没有启用自定义文本，返回默认文本
        if (!settings.showCustomFooterText) {
            return t("default_footer_text");
        }
        // 如果不使用随机文本，返回自定义文本或默认文本
        if (!settings.useRandomFooterText) {
            return settings.customFooterText || t("default_footer_text");
        }
        // 如果使用随机文本，根据语言返回随机文本
        const obsidianLang = getLanguage() || "en";
        if (obsidianLang === "zh") {
            return await FooterTextUtil.getChineseRandomFooterText(plugin);
        } else {
            return await FooterTextUtil.getEnglishRandomFooterText(plugin);
        }
    }

//     {
//     "status": "success",
//     "data": {
//         "id": "5b8b9572e116fb3714e7378b",
//         "content": "塞上秋风鼓角，城头落日旌旗。",
//         "popularity": 18600,
//         "origin": {
//             "title": "江月晃重山·初到嵩山时作",
//             "dynasty": "金朝",
//             "author": "元好问",
//             "content": [
//                 "塞上秋风鼓角，城头落日旌旗。少年鞍马适相宜。从军乐，莫问所从谁。",
//                 "侯骑才通蓟北，先声已动辽西。归期犹及柳依依。春闺月，红袖不须啼。"
//             ],
//             "translate": [
//                 "军队中的鼓声、角声在秋风中作响，城头上的旗帜在夕阳的照耀下缓缓地飘动。 少年应当从军，身跨战马，驰骋边关。只要能够从军驰骋就十分快乐，并不要在乎由谁来带兵。",
//                 "侦察的骑兵才通过蓟北，而部队的威名已震动辽西。等打完仗，回到故乡时，仍是杨柳依依的春天，时间不会太长。 征人连战连胜，可以很快凯旋，闺中人不必因相思而流泪。"
//             ]
//         },
//         "matchTags": [
//             "日落",
//             "秋",
//             "风"
//         ],
//         "recommendedReason": "",
//         "cacheAt": "2025-11-17T17:59:04.520048707"
//     },
//     "token": "3hCO1PU/EYmrHz/DNlP9baTHG8IgwXLd",
//     "ipAddress": "182.151.174.106",
//     "warning": null
// }
    static async getChineseRandomFooterText(plugin: StartPagePlugin): Promise<string> {
        const settings: StartPageSettings = plugin.settings;

        const today: string = new Date().toISOString().slice(0, 10);

        if (settings.todayRandomZhFooterText && settings.todayRandomZhFooterText.startsWith(today)) {
            return settings.todayRandomZhFooterText.split("|")[1];
        }
        
        try {
            // Add timeout to prevent UI blocking
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            let response = await fetch(QUOTE_API_URL_ZH, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            let result = await response.json();
            if (!result.statusCode) {
                let text = `${result.data.content} - ${result.data.origin.author}`;
                settings.todayRandomZhFooterText = `${today}|${text}`;
                plugin.saveSettings();
                return text;
            }
        } catch (err) {
            console.log("Error fetching Chinese footer text:", err);
        }
        return t("default_footer_text");
    }

// {
//   "_id": "YC9amT8URZZ",
//   "content": "Science is organized knowledge. Wisdom is organized life.",
//   "author": "Immanuel Kant",
//   "tags": [
//     "Famous Quotes",
//     "Wisdom"
//   ],
//   "authorSlug": "immanuel-kant",
//   "length": 57,
//   "dateAdded": "2020-10-14",
//   "dateModified": "2023-04-14"
// }
    static async getEnglishRandomFooterText(plugin: StartPagePlugin): Promise<string> {
        const settings: StartPageSettings = plugin.settings;
        const today: string = new Date().toISOString().slice(0, 10);
        if (settings.todayRandomEnFooterText && settings.todayRandomEnFooterText.startsWith(today)) {
            return settings.todayRandomEnFooterText.split("|")[1];
        }
        try {
            // Add timeout to prevent UI blocking
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            let response = await fetch(QUOTE_API_URL_EN, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            let result = await response.json();
            if (!result.statusCode) {
                let text = `${result.content} - ${result.author}`;
                settings.todayRandomEnFooterText = `${today}|${text}`;
                plugin.saveSettings();
                return text;
            }
        } catch (err) {
            console.log("Error fetching English footer text:", err);
        }
        return t("default_footer_text");
    }
}