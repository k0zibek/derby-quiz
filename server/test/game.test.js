import assert from "node:assert/strict";
import test from "node:test";

import { createSessionManager } from "../game.js";

const sampleQuestions = [
    {
        id: "q1",
        text: "2 + 2",
        options: ["3", "4", "5"],
        correctIndex: 1,
    },
    {
        id: "q2",
        text: "3 + 3",
        options: ["5", "6", "7"],
        correctIndex: 1,
    },
];

test("session manager creates session and exposes teacher controls", () => {
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "ABC123",
    });

    const created = manager.createSession();
    assert.equal(created.ok, true);
    assert.equal(created.code, "ABC123");

    const teacherState = manager.getTeacherState("ABC123");
    assert.equal(teacherState.ok, true);
    assert.equal(teacherState.state.status, "lobby");
    assert.equal(teacherState.state.canStart, true);
    assert.equal(teacherState.state.canShowResults, false);
    assert.equal(teacherState.state.canGoNext, false);
});

test("session manager rejects invalid state transitions", () => {
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "ROOM01",
    });

    manager.createSession();

    const beforeStart = manager.showResults("ROOM01");
    assert.equal(beforeStart.ok, false);
    assert.equal(beforeStart.code, "INVALID_TRANSITION");

    const firstStart = manager.startQuestion("ROOM01");
    assert.equal(firstStart.ok, true);

    const secondStart = manager.startQuestion("ROOM01");
    assert.equal(secondStart.ok, false);
    assert.equal(secondStart.code, "INVALID_TRANSITION");
});

test("session manager handles player join, answer submission, and finish flow", () => {
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "FLOW01",
        createPlayerId: () => "PLAYER1",
    });

    manager.createSession();

    const joined = manager.joinPlayer({ code: "FLOW01", name: "Aru", socketId: "socket-1" });
    assert.equal(joined.ok, true);
    assert.equal(joined.playerId, "PLAYER1");

    assert.equal(manager.startQuestion("FLOW01").ok, true);

    const answer = manager.submitAnswer({
        code: "FLOW01",
        playerId: "PLAYER1",
        optionIndex: 1,
    });

    assert.equal(answer.ok, true);
    assert.equal(answer.isCorrect, true);
    assert.equal(answer.totalScore, 10);
    assert.equal(answer.progress, 10);

    const secondAnswer = manager.submitAnswer({
        code: "FLOW01",
        playerId: "PLAYER1",
        optionIndex: 1,
    });
    assert.equal(secondAnswer.ok, false);
    assert.equal(secondAnswer.code, "ALREADY_ANSWERED");

    assert.equal(manager.showResults("FLOW01").ok, true);
    const nextQuestion = manager.nextQuestion("FLOW01");
    assert.equal(nextQuestion.ok, true);
    assert.equal(nextQuestion.finished, false);

    assert.equal(manager.startQuestion("FLOW01").ok, true);
    assert.equal(manager.showResults("FLOW01").ok, true);
    const finished = manager.nextQuestion("FLOW01");
    assert.equal(finished.ok, true);
    assert.equal(finished.finished, true);

    const playerState = manager.rejoinPlayer({
        code: "FLOW01",
        playerId: "PLAYER1",
        socketId: "socket-2",
    });
    assert.equal(playerState.ok, true);
    assert.equal(playerState.state, undefined);
    assert.equal(playerState.playerState.status, "finished");
});

test("session manager removes expired sessions on cleanup", () => {
    let currentTime = 1000;
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "TTL001",
        now: () => currentTime,
        sessionTtlMs: 100,
    });

    manager.createSession();
    currentTime = 1201;

    assert.equal(manager.cleanupExpiredSessions(), 1);
    const sessionState = manager.getTeacherState("TTL001");
    assert.equal(sessionState.ok, false);
    assert.equal(sessionState.code, "SESSION_NOT_FOUND");
});
