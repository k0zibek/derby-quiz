import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    defaultLocale,
    defaultTheme,
    loadLocale,
    loadTheme,
    saveLocale,
    saveTheme,
} from "./preferences";

function createStorage(initial: Record<string, string> = {}): Storage {
    const values = new Map(Object.entries(initial));

    return {
        get length() {
            return values.size;
        },
        clear() {
            values.clear();
        },
        getItem(key: string) {
            return values.get(key) ?? null;
        },
        key(index: number) {
            return Array.from(values.keys())[index] ?? null;
        },
        removeItem(key: string) {
            values.delete(key);
        },
        setItem(key: string, value: string) {
            values.set(key, value);
        },
    };
}

describe("client preferences", () => {
    it("loads defaults when storage is empty or invalid", () => {
        assert.equal(loadLocale(createStorage()), defaultLocale);
        assert.equal(loadTheme(createStorage()), defaultTheme);

        assert.equal(loadLocale(createStorage({ "quiz.locale": "en" })), defaultLocale);
        assert.equal(loadTheme(createStorage({ "quiz.theme": "sepia" })), defaultTheme);
    });

    it("persists valid locale and theme choices", () => {
        const storage = createStorage();

        saveLocale(storage, "ru");
        saveTheme(storage, "dark");

        assert.equal(loadLocale(storage), "ru");
        assert.equal(loadTheme(storage), "dark");
    });
});
