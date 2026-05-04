import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { PersistedSession } from "../../shared/types.js";
import { createClassroomDatabase } from "../db/database.js";
import { ClassroomRepository } from "../db/repository.js";

function createTempRepository() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kahoot-horses-db-"));
    const database = createClassroomDatabase(path.join(dir, "classroom.sqlite"));
    return {
        repository: new ClassroomRepository(database),
        close: () => database.close(),
    };
}

test("repository saves and restores persisted session snapshots", () => {
    const { repository, close } = createTempRepository();

    try {
        const session: PersistedSession = {
            code: "ROOM42",
            teacherToken: "teacher-token",
            createdAt: 1000,
            updatedAt: 1000,
            expiresAt: 999999,
            status: "question",
            currentQuestionIndex: 0,
            questions: [
                {
                    id: "q1",
                    type: "mcq",
                    stem: "2 + 2",
                    passageTitle: null,
                    passage: null,
                    image: null,
                    options: [
                        { label: "A", text: "3", image: null },
                        { label: "B", text: "4", image: null },
                    ],
                    correctIndex: 1,
                    groupId: null,
                    sourceMeta: null,
                },
            ],
            players: {
                P1: {
                    id: "P1",
                    playerToken: "player-token",
                    name: "Aru",
                    score: 10,
                    progress: 10,
                    color: "#2563eb",
                    connected: false,
                    answeredCurrent: true,
                    selectedOption: 1,
                    lastAnswerCorrect: true,
                    joinedAt: 1001,
                },
            },
        };

        repository.saveSession(session);
        const restored = repository.listSessions();

        assert.equal(restored.length, 1);
        assert.deepEqual(restored[0], session);
    } finally {
        close();
    }
});

test("repository records answer rows", () => {
    const { repository, close } = createTempRepository();

    try {
        const answer = repository.recordAnswer({
            sessionCode: "ROOM42",
            playerId: "P1",
            questionId: "q1",
            questionIndex: 0,
            optionIndex: 1,
            isCorrect: true,
            points: 10,
            answeredAt: 1234,
        });

        assert.equal(answer.sessionCode, "ROOM42");
        assert.equal(answer.isCorrect, true);
        assert.ok(answer.id);
    } finally {
        close();
    }
});
