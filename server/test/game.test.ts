import assert from "node:assert/strict";
import test from "node:test";

import type { Question } from "../../shared/types.js";
import { createSessionManager } from "../game.js";

const sampleQuestions: Question[] = [
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
            { label: "C", text: "5", image: null },
        ],
        correctIndex: 1,
        groupId: null,
        sourceMeta: null,
    },
    {
        id: "q2",
        type: "mcq",
        stem: "3 + 3",
        passageTitle: null,
        passage: null,
        image: null,
        options: [
            { label: "A", text: "5", image: null },
            { label: "B", text: "6", image: null },
            { label: "C", text: "7", image: null },
        ],
        correctIndex: 1,
        groupId: null,
        sourceMeta: null,
    },
];

test("session manager creates session and exposes teacher controls", () => {
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "ABC123",
        createTeacherToken: () => "teacher-token",
    });

    const created = manager.createSession();
    assert.equal(created.ok, true);
    assert.ok(created.ok);
    assert.equal(created.code, "ABC123");
    assert.equal(created.teacherToken, "teacher-token");

    const teacherState = manager.getTeacherState({ code: "ABC123", teacherToken: "teacher-token" });
    assert.equal(teacherState.ok, true);
    assert.ok(teacherState.ok);
    assert.equal(teacherState.state.status, "lobby");
    assert.equal(teacherState.state.canStart, true);
    assert.equal(teacherState.state.canShowResults, false);
    assert.equal(teacherState.state.canGoNext, false);
});

test("session manager snapshots questions when creating a session", () => {
    const mutableQuestions = structuredClone(sampleQuestions);
    const manager = createSessionManager({
        createCode: () => "COPY01",
        createTeacherToken: () => "teacher-token",
    });

    const created = manager.createSession({ questions: mutableQuestions });
    assert.equal(created.ok, true);
    assert.ok(created.ok);

    mutableQuestions[0]!.stem = "Changed outside session";
    mutableQuestions[0]!.options[0]!.text = "Changed option";

    const session = manager.getSession("COPY01");
    assert.equal(session?.questions[0]?.stem, "2 + 2");
    assert.equal(session?.questions[0]?.options[0]?.text, "3");
});

test("session manager rejects invalid state transitions", () => {
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "ROOM01",
        createTeacherToken: () => "teacher-token",
    });

    manager.createSession();

    const beforeStart = manager.showResults({ code: "ROOM01", teacherToken: "teacher-token" });
    assert.equal(beforeStart.ok, false);
    assert.equal(beforeStart.code, "INVALID_TRANSITION");

    const firstStart = manager.startQuestion({ code: "ROOM01", teacherToken: "teacher-token" });
    assert.equal(firstStart.ok, true);

    const secondStart = manager.startQuestion({ code: "ROOM01", teacherToken: "teacher-token" });
    assert.equal(secondStart.ok, false);
    assert.equal(secondStart.code, "INVALID_TRANSITION");
});

test("session manager handles player join, answer submission, and finish flow", () => {
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "FLOW01",
        createPlayerId: () => "PLAYER1",
        createTeacherToken: () => "teacher-token",
        createPlayerToken: () => "player-token",
    });

    manager.createSession();

    const joined = manager.joinPlayer({ code: "FLOW01", name: "Aru", socketId: "socket-1" });
    assert.equal(joined.ok, true);
    assert.ok(joined.ok);
    assert.equal(joined.playerId, "PLAYER1");
    assert.equal(joined.playerToken, "player-token");

    assert.equal(manager.startQuestion({ code: "FLOW01", teacherToken: "teacher-token" }).ok, true);

    const answer = manager.submitAnswer({
        code: "FLOW01",
        playerId: "PLAYER1",
        playerToken: "player-token",
        optionIndex: 1,
    });

    assert.equal(answer.ok, true);
    assert.ok(answer.ok);
    assert.equal(answer.isCorrect, true);
    assert.equal(answer.totalScore, 10);
    assert.equal(answer.progress, 10);

    const secondAnswer = manager.submitAnswer({
        code: "FLOW01",
        playerId: "PLAYER1",
        playerToken: "player-token",
        optionIndex: 1,
    });
    assert.equal(secondAnswer.ok, false);
    assert.equal(secondAnswer.code, "ALREADY_ANSWERED");

    assert.equal(manager.showResults({ code: "FLOW01", teacherToken: "teacher-token" }).ok, true);
    const nextQuestion = manager.nextQuestion({ code: "FLOW01", teacherToken: "teacher-token" });
    assert.equal(nextQuestion.ok, true);
    assert.ok(nextQuestion.ok);
    assert.equal(nextQuestion.finished, false);

    assert.equal(manager.startQuestion({ code: "FLOW01", teacherToken: "teacher-token" }).ok, true);
    assert.equal(manager.showResults({ code: "FLOW01", teacherToken: "teacher-token" }).ok, true);
    const finished = manager.nextQuestion({ code: "FLOW01", teacherToken: "teacher-token" });
    assert.equal(finished.ok, true);
    assert.ok(finished.ok);
    assert.equal(finished.finished, true);

    const playerState = manager.rejoinPlayer({
        code: "FLOW01",
        playerId: "PLAYER1",
        playerToken: "player-token",
        socketId: "socket-2",
    });
    assert.equal(playerState.ok, true);
    assert.ok(playerState.ok);
    assert.equal(playerState.playerState.status, "finished");
});

test("session manager removes expired sessions on cleanup", () => {
    let currentTime = 1000;
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "TTL001",
        now: () => currentTime,
        sessionTtlMs: 100,
        createTeacherToken: () => "teacher-token",
    });

    manager.createSession();
    currentTime = 1201;

    assert.equal(manager.cleanupExpiredSessions(), 1);
    const sessionState = manager.getTeacherState({ code: "TTL001", teacherToken: "teacher-token" });
    assert.equal(sessionState.ok, false);
    assert.ok(!sessionState.ok);
    assert.equal(sessionState.code, "SESSION_NOT_FOUND");
});

test("session manager rejects invalid teacher and player tokens", () => {
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "AUTH01",
        createTeacherToken: () => "teacher-token",
        createPlayerId: () => "PLAYER1",
        createPlayerToken: () => "player-token",
    });

    manager.createSession();
    manager.joinPlayer({ code: "AUTH01", name: "Aru", socketId: "socket-1" });

    const invalidTeacher = manager.startQuestion({ code: "AUTH01", teacherToken: "bad-token" });
    assert.equal(invalidTeacher.ok, false);
    assert.ok(!invalidTeacher.ok);
    assert.equal(invalidTeacher.code, "UNAUTHORIZED");

    const invalidPlayer = manager.rejoinPlayer({
        code: "AUTH01",
        playerId: "PLAYER1",
        playerToken: "bad-token",
        socketId: "socket-2",
    });
    assert.equal(invalidPlayer.ok, false);
    assert.ok(!invalidPlayer.ok);
    assert.equal(invalidPlayer.code, "UNAUTHORIZED");
});

test("session manager does not overwrite an existing session on code collision", () => {
    const codes = ["SAME01", "SAME01", "NEXT01"];
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => codes.shift() ?? "NEXT01",
        createTeacherToken: () => nanoidLikeToken(codes.length),
    });

    const first = manager.createSession();
    assert.ok(first.ok);
    const second = manager.createSession();
    assert.ok(second.ok);

    assert.equal(first.code, "SAME01");
    assert.equal(second.code, "NEXT01");
    assert.equal(manager.getSession("SAME01")?.teacherToken, first.teacherToken);
});

test("session manager rejects fractional answer option indexes", () => {
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        createCode: () => "FRACT1",
        createPlayerId: () => "PLAYER1",
        createTeacherToken: () => "teacher-token",
        createPlayerToken: () => "player-token",
    });

    manager.createSession();
    manager.joinPlayer({ code: "FRACT1", name: "Aru", socketId: "socket-1" });
    assert.equal(manager.startQuestion({ code: "FRACT1", teacherToken: "teacher-token" }).ok, true);

    const answer = manager.submitAnswer({
        code: "FRACT1",
        playerId: "PLAYER1",
        playerToken: "player-token",
        optionIndex: 1.5,
    });

    assert.equal(answer.ok, false);
    assert.ok(!answer.ok);
    assert.equal(answer.code, "INVALID_OPTION_INDEX");
});

test("session manager enforces max players per session", () => {
    let playerCounter = 0;
    const manager = createSessionManager({
        initialQuestions: sampleQuestions,
        maxPlayersPerSession: 1,
        createCode: () => "FULL01",
        createPlayerId: () => `PLAYER${++playerCounter}`,
        createTeacherToken: () => "teacher-token",
        createPlayerToken: () => "player-token",
    });

    manager.createSession();

    const first = manager.joinPlayer({ code: "FULL01", name: "Aru", socketId: "socket-1" });
    assert.equal(first.ok, true);

    const second = manager.joinPlayer({ code: "FULL01", name: "Dana", socketId: "socket-2" });
    assert.equal(second.ok, false);
    assert.ok(!second.ok);
    assert.equal(second.code, "SESSION_FULL");
});

function nanoidLikeToken(seed: number): string {
    return `teacher-token-${seed}`;
}
