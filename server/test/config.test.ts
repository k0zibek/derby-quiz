import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../config.js";

test("loadConfig applies defaults and trims configured origins", () => {
    const config = loadConfig({
        TEACHER_ACCESS_PIN: " 123456 ",
        CLIENT_ORIGINS: " http://localhost:5173, https://quiz.example ",
    });

    assert.equal(config.port, 4000);
    assert.equal(config.teacherAccessPin, "123456");
    assert.deepEqual(config.clientOrigins, ["http://localhost:5173", "https://quiz.example"]);
});

test("loadConfig rejects malformed and out-of-range integer env values", () => {
    assert.throws(() => loadConfig({ PORT: "4000abc" }), /PORT must be an integer/);
    assert.throws(() => loadConfig({ PORT: "70000" }), /PORT must be >= 1 and <= 65535/);
    assert.throws(() => loadConfig({ MAX_PLAYERS_PER_SESSION: "0" }), /MAX_PLAYERS_PER_SESSION must be >= 1/);
    assert.throws(() => loadConfig({ SESSION_TTL_MS: "-1" }), /SESSION_TTL_MS must be >= 1/);
    assert.throws(() => loadConfig({ SESSION_CLEANUP_INTERVAL_MS: "1.5" }), /SESSION_CLEANUP_INTERVAL_MS must be an integer/);
});
