import en from "../locales/en.json";
import zh from "../locales/zh.json";

type LocaleStrings = typeof en;

const languages: Record<string, LocaleStrings> = {
  en,
  zh
};

let currentStrings = en;

export function setLocale(lang: string) {
  if (languages[lang]) {
    currentStrings = languages[lang];
    return;
  }

  // Obsidian 可能返回 zh-TW 等变体，需回退到基础语言而非英文
  const base = lang.split("-")[0];
  if (languages[base]) {
    currentStrings = languages[base];
  }
}

export function t(key: keyof LocaleStrings, ...args: string[]): string {
  let text = currentStrings[key] || key;
  args.forEach((arg, index) => {
    text = text.replace(`{${index}}`, arg);
  });
  return text;
}
