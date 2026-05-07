import { createContext, useContext } from "react";

import type { Messages } from "./i18n/messages";
import type { Locale, Theme } from "./preferences";

export type AppPreferences = {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    messages: Messages;
};

export const AppPreferencesContext = createContext<AppPreferences | null>(null);

export function useAppPreferences() {
    const context = useContext(AppPreferencesContext);
    if (!context) {
        throw new Error("useAppPreferences must be used inside AppPreferencesProvider");
    }
    return context;
}
