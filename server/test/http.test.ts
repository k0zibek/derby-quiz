import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { AppConfig } from "../config.js";
import { createAppServer } from "../index.js";

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
    return {
        port: 0,
        clientOrigins: "*",
        maxPlayersPerSession: 50,
        sessionTtlMs: 1000 * 60 * 60,
        cleanupIntervalMs: 1000 * 60 * 60,
        teacherAccessPin: "test-pin",
        teacherAccessPinIsGenerated: false,
        databasePath: ":memory:",
        staticDir: null,
        ...overrides,
    };
}

test("fastify app exposes health, readiness, and classroom info endpoints", async () => {
    const runtime = await createAppServer({ config: testConfig(), repository: null });

    try {
        const health = await runtime.app.inject({ method: "GET", url: "/health" });
        assert.equal(health.statusCode, 200);
        assert.equal(health.json().status, "healthy");

        const ready = await runtime.app.inject({ method: "GET", url: "/ready" });
        assert.equal(ready.statusCode, 200);
        assert.equal(ready.json().status, "ready");

        const classroomInfo = await runtime.app.inject({ method: "GET", url: "/classroom-info" });
        assert.equal(classroomInfo.statusCode, 200);
        assert.equal(classroomInfo.json().teacherAccessPin, "test-pin");
    } finally {
        await runtime.close();
    }
});

test("fastify app serves static client and SPA fallback when configured", async () => {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "kahoot-horses-static-"));
    fs.writeFileSync(path.join(staticDir, "index.html"), "<!doctype html><div id=\"root\"></div>");

    const runtime = await createAppServer({
        config: testConfig({ staticDir }),
        repository: null,
    });

    try {
        const root = await runtime.app.inject({ method: "GET", url: "/" });
        assert.equal(root.statusCode, 200);
        assert.match(root.body, /root/);

        const route = await runtime.app.inject({ method: "GET", url: "/teacher" });
        assert.equal(route.statusCode, 200);
        assert.match(route.body, /root/);
    } finally {
        await runtime.close();
    }
});
