import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMessages } from "./messages";

describe("i18n messages", () => {
    it("returns Kazakh messages by default and Russian messages when selected", () => {
        assert.equal(getMessages("kk").buttons.connect, "Қосылу");
        assert.equal(getMessages("ru").buttons.connect, "Подключиться");
    });
});
