import { type ReactNode, useEffect, useMemo, useState } from "react";

import { getMessages } from "./i18n/messages";
import { AppPreferencesContext, type AppPreferences } from "./appPreferencesContext";
import {
    defaultLocale,
    defaultTheme,
    loadLocale,
    loadTheme,
    type Locale,
    saveLocale,
    saveTheme,
    type Theme,
} from "./preferences";

function getInitialLocale(): Locale {
    if (typeof window === "undefined") return defaultLocale;
    return loadLocale(window.localStorage);
}

function getInitialTheme(): Theme {
    if (typeof window === "undefined") return defaultTheme;
    return loadTheme(window.localStorage);
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.lang = locale === "kk" ? "kk" : "ru";
    }, [locale, theme]);

    const value = useMemo<AppPreferences>(() => ({
        locale,
        setLocale(nextLocale) {
            setLocaleState(nextLocale);
            saveLocale(window.localStorage, nextLocale);
        },
        theme,
        setTheme(nextTheme) {
            setThemeState(nextTheme);
            saveTheme(window.localStorage, nextTheme);
        },
        messages: getMessages(locale),
    }), [locale, theme]);

    return (
        <AppPreferencesContext.Provider value={value}>
            {children}
        </AppPreferencesContext.Provider>
    );
}
