import en from "./locales/en.json";
import zh from "./locales/zh.json";

type LocaleStrings = typeof en;

const languages: Record<string, LocaleStrings> = {
  en,
  zh
};

let currentLang = "en";
let currentStrings = en;

export function setLocale(lang: string) {
  if (languages[lang]) {
    currentLang = lang;
    currentStrings = languages[lang];
  }
}

export function t(key: keyof LocaleStrings): string {
  return currentStrings[key] || key;
}
