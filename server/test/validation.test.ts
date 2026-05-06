import assert from "node:assert/strict";
import test from "node:test";

import { textQuestionDraftSchema } from "../validation.js";

test("text question validation accepts a valid MCQ draft", () => {
    const parsed = textQuestionDraftSchema.safeParse({
        stem: "2 + 2",
        options: ["4", "5"],
        correctIndex: 0,
    });

    assert.equal(parsed.success, true);
});

test("text question validation rejects empty stem", () => {
    const parsed = textQuestionDraftSchema.safeParse({
        stem: "",
        options: ["4", "5"],
        correctIndex: 0,
    });

    assert.equal(parsed.success, false);
});

test("text question validation rejects fewer than two options", () => {
    const parsed = textQuestionDraftSchema.safeParse({
        stem: "2 + 2",
        options: ["4"],
        correctIndex: 0,
    });

    assert.equal(parsed.success, false);
});

test("text question validation rejects more than six options", () => {
    const parsed = textQuestionDraftSchema.safeParse({
        stem: "2 + 2",
        options: ["1", "2", "3", "4", "5", "6", "7"],
        correctIndex: 0,
    });

    assert.equal(parsed.success, false);
});

test("text question validation rejects invalid correctIndex", () => {
    const parsed = textQuestionDraftSchema.safeParse({
        stem: "2 + 2",
        options: ["4", "5"],
        correctIndex: 2,
    });

    assert.equal(parsed.success, false);
});
