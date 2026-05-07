export const locales = ["kk", "ru"] as const;
export const themes = ["light", "dark"] as const;

export type Locale = (typeof locales)[number];
export type Theme = (typeof themes)[number];

export const defaultLocale: Locale = "kk";
export const defaultTheme: Theme = "light";

const localeStorageKey = "quiz.locale";
const themeStorageKey = "quiz.theme";

function isLocale(value: string | null): value is Locale {
    return value === "kk" || value === "ru";
}

function isTheme(value: string | null): value is Theme {
    return value === "light" || value === "dark";
}

export function loadLocale(storage: Pick<Storage, "getItem"> = window.localStorage): Locale {
    const storedLocale = storage.getItem(localeStorageKey);
    return isLocale(storedLocale) ? storedLocale : defaultLocale;
}

export function saveLocale(storage: Pick<Storage, "setItem">, locale: Locale) {
    storage.setItem(localeStorageKey, locale);
}

export function loadTheme(storage: Pick<Storage, "getItem"> = window.localStorage): Theme {
    const storedTheme = storage.getItem(themeStorageKey);
    return isTheme(storedTheme) ? storedTheme : defaultTheme;
}

export function saveTheme(storage: Pick<Storage, "setItem">, theme: Theme) {
    storage.setItem(themeStorageKey, theme);
}
