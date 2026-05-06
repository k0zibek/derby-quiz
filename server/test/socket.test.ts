import assert from "node:assert/strict";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { io as createClient, type Socket as ClientSocket } from "socket.io-client";

import type {
    ClientToServerEvents,
    QuestionSetDraft,
    ServerToClientEvents,
    SessionState,
} from "../../shared/types.js";
import type { AppConfig } from "../config.js";
import { createAppServer } from "../index.js";

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;
type AckEmitter = {
    emit: (eventName: string, payload: object, callback: (response: unknown) => void) => void;
};

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

function onceConnect(socket: TestSocket): Promise<void> {
    return new Promise((resolve) => {
        socket.once("connect", () => resolve());
    });
}

function onceState(socket: TestSocket): Promise<SessionState> {
    return new Promise((resolve) => {
        socket.once("session:state", resolve);
    });
}

function waitForState(socket: TestSocket, predicate: (state: SessionState) => boolean): Promise<SessionState> {
    return new Promise((resolve) => {
        const handler = (state: SessionState) => {
            if (!predicate(state)) return;

            socket.off("session:state", handler);
            resolve(state);
        };

        socket.on("session:state", handler);
    });
}

function emitAck<T>(socket: TestSocket, eventName: string, payload: object): Promise<T> {
    return new Promise((resolve) => {
        (socket as AckEmitter).emit(eventName, payload, (response) => resolve(response as T));
    });
}

const sampleQuestionSetDraft: QuestionSetDraft = {
    title: "Math warmup",
    questions: [
        {
            stem: "2 + 2",
            options: ["4", "5"],
            correctIndex: 0,
        },
        {
            stem: "3 + 3",
            options: ["6", "7"],
            correctIndex: 0,
        },
    ],
};

async function createQuestionSet(socket: TestSocket) {
    const created = await emitAck<{ ok: true; questionSet: { id: string } }>(
        socket,
        "questionSet:create",
        { accessPin: "test-pin", questionSet: sampleQuestionSetDraft }
    );

    assert.equal(created.ok, true);
    return created.questionSet.id;
}

test("socket flow covers teacher, players, results, and finish", async () => {
    const runtime = await createAppServer({
        config: testConfig(),
    });

    await runtime.listen("127.0.0.1");

    const address = runtime.server.address();
    assert.ok(address && typeof address !== "string");
    const serverUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    const teacher: TestSocket = createClient(serverUrl, { transports: ["websocket"] });
    const playerOne: TestSocket = createClient(serverUrl, { transports: ["websocket"] });
    const playerTwo: TestSocket = createClient(serverUrl, { transports: ["websocket"] });

    try {
        await Promise.all([
            onceConnect(teacher),
            onceConnect(playerOne),
            onceConnect(playerTwo),
        ]);

        const deniedTeacher = await emitAck<{ ok: false; code: string }>(
            teacher,
            "teacher:createSession",
            { accessPin: "bad-pin", questionSetId: "missing" }
        );
        assert.equal(deniedTeacher.ok, false);
        assert.equal(deniedTeacher.code, "TEACHER_ACCESS_DENIED");

        const missingSet = await emitAck<{ ok: false; code: string }>(
            teacher,
            "teacher:createSession",
            { accessPin: "test-pin", questionSetId: "missing" }
        );
        assert.equal(missingSet.ok, false);
        assert.equal(missingSet.code, "QUESTION_SET_NOT_FOUND");

        const questionSetId = await createQuestionSet(teacher);
        const teacherCreated = await emitAck<{ ok: true; code: string; teacherToken: string }>(
            teacher,
            "teacher:createSession",
            { accessPin: "test-pin", questionSetId }
        );
        assert.equal(teacherCreated.ok, true);

        const code = teacherCreated.code;
        const teacherToken = teacherCreated.teacherToken;
        const teacherStatePromise = waitForState(
            teacher,
            (state) => state.role === "teacher" && state.totalPlayers >= 1
        );
        const joinedOne = await emitAck<{ ok: true; playerId: string; playerToken: string }>(
            playerOne,
            "player:join",
            { code, name: "Aru" }
        );
        const joinedTwo = await emitAck<{ ok: true; playerId: string; playerToken: string }>(
            playerTwo,
            "player:join",
            { code, name: "Dana" }
        );

        assert.equal(joinedOne.ok, true);
        assert.equal(joinedTwo.ok, true);
        assert.ok(joinedOne.playerToken);
        assert.ok(joinedTwo.playerToken);

        const teacherState = await teacherStatePromise;
        assert.equal(teacherState.role, "teacher");
        assert.equal(teacherState.totalPlayers, 1);

        const unauthorizedTeacher = await emitAck<{ ok: false; code: string }>(
            teacher,
            "teacher:startQuestion",
            { code, teacherToken: "bad-token" }
        );
        assert.equal(unauthorizedTeacher.ok, false);
        assert.equal(unauthorizedTeacher.code, "UNAUTHORIZED");

        const invalidPayload = await emitAck<{ ok: false; code: string }>(
            teacher,
            "teacher:startQuestion",
            { code }
        );
        assert.equal(invalidPayload.ok, false);
        assert.equal(invalidPayload.code, "INVALID_PAYLOAD");

        const startQuestion = await emitAck<{ ok: true }>(
            teacher,
            "teacher:startQuestion",
            { code, teacherToken }
        );
        assert.equal(startQuestion.ok, true);

        const [playerOneQuestion] = await Promise.all([
            onceState(playerOne),
            onceState(playerTwo),
        ]);
        assert.equal(playerOneQuestion.status, "question");

        const addDuringQuestion = await emitAck<{ ok: false; code: string }>(
            teacher,
            "session:addQuestion",
            {
                code,
                teacherToken,
                question: {
                    stem: "Retry question",
                    options: ["A", "B"],
                    correctIndex: 0,
                },
            }
        );
        assert.equal(addDuringQuestion.ok, false);
        assert.equal(addDuringQuestion.code, "INVALID_TRANSITION");

        const invalidOption = await emitAck<{ ok: false; code: string }>(
            playerTwo,
            "player:submitAnswer",
            {
                code,
                playerId: joinedTwo.playerId,
                playerToken: joinedTwo.playerToken,
                optionIndex: 1.5,
            }
        );
        assert.equal(invalidOption.ok, false);
        assert.equal(invalidOption.code, "INVALID_PAYLOAD");

        const submitOne = await emitAck<{ ok: true }>(
            playerOne,
            "player:submitAnswer",
            {
                code,
                playerId: joinedOne.playerId,
                playerToken: joinedOne.playerToken,
                optionIndex: 0,
            }
        );
        const submitTwo = await emitAck<{ ok: true }>(
            playerTwo,
            "player:submitAnswer",
            {
                code,
                playerId: joinedTwo.playerId,
                playerToken: joinedTwo.playerToken,
                optionIndex: 0,
            }
        );

        assert.equal(submitOne.ok, true);
        assert.equal(submitTwo.ok, true);

        const unauthorizedPlayer = await emitAck<{ ok: false; code: string }>(
            playerOne,
            "player:submitAnswer",
            {
                code,
                playerId: joinedOne.playerId,
                playerToken: "bad-token",
                optionIndex: 0,
            }
        );
        assert.equal(unauthorizedPlayer.ok, false);
        assert.equal(unauthorizedPlayer.code, "UNAUTHORIZED");

        const showResults = await emitAck<{ ok: true }>(
            teacher,
            "teacher:showResults",
            { code, teacherToken }
        );
        assert.equal(showResults.ok, true);

        const addedStatePromise = waitForState(
            teacher,
            (state) => state.role === "teacher" && state.totalQuestions === 3
        );
        const addAfterResults = await emitAck<{ ok: true }>(
            teacher,
            "session:addQuestion",
            {
                code,
                teacherToken,
                question: {
                    stem: "Comeback",
                    options: ["Дұрыс", "Қате"],
                    correctIndex: 0,
                },
            }
        );
        assert.equal(addAfterResults.ok, true);
        const addedState = await addedStatePromise;
        assert.equal(addedState.role, "teacher");
        assert.equal(addedState.totalQuestions, 3);

        const nextQuestion = await emitAck<{ ok: true; finished: boolean }>(
            teacher,
            "teacher:nextQuestion",
            { code, teacherToken }
        );
        assert.equal(nextQuestion.ok, true);
        assert.equal(nextQuestion.finished, false);
    } finally {
        teacher.close();
        playerOne.close();
        playerTwo.close();
        await runtime.close();
    }
});

test("socket session can be restored from SQLite after server restart", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kahoot-horses-restore-"));
    const databasePath = path.join(dir, "classroom.sqlite");
    const config = testConfig({ databasePath });

    const firstRuntime = await createAppServer({ config });
    await firstRuntime.listen("127.0.0.1");
    const firstAddress = firstRuntime.server.address();
    assert.ok(firstAddress && typeof firstAddress !== "string");
    const firstUrl = `http://127.0.0.1:${(firstAddress as AddressInfo).port}`;
    const firstTeacher: TestSocket = createClient(firstUrl, { transports: ["websocket"] });

    let code = "";
    let teacherToken = "";
    try {
        await onceConnect(firstTeacher);
        const questionSetId = await createQuestionSet(firstTeacher);
        const created = await emitAck<{ ok: true; code: string; teacherToken: string }>(
            firstTeacher,
            "teacher:createSession",
            { accessPin: "test-pin", questionSetId }
        );
        assert.equal(created.ok, true);
        code = created.code;
        teacherToken = created.teacherToken;
    } finally {
        firstTeacher.close();
        await firstRuntime.close();
    }

    const secondRuntime = await createAppServer({ config });
    await secondRuntime.listen("127.0.0.1");
    const secondAddress = secondRuntime.server.address();
    assert.ok(secondAddress && typeof secondAddress !== "string");
    const secondUrl = `http://127.0.0.1:${(secondAddress as AddressInfo).port}`;
    const secondTeacher: TestSocket = createClient(secondUrl, { transports: ["websocket"] });

    try {
        await onceConnect(secondTeacher);
        const rejoined = await emitAck<{ ok: true }>(
            secondTeacher,
            "teacher:joinSession",
            { code, teacherToken }
        );
        assert.equal(rejoined.ok, true);
    } finally {
        secondTeacher.close();
        await secondRuntime.close();
    }
});

test("socket flow returns SESSION_FULL when max players is reached", async () => {
    const runtime = await createAppServer({
        config: testConfig({ maxPlayersPerSession: 1 }),
    });

    await runtime.listen("127.0.0.1");

    const address = runtime.server.address();
    assert.ok(address && typeof address !== "string");
    const serverUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    const teacher: TestSocket = createClient(serverUrl, { transports: ["websocket"] });
    const playerOne: TestSocket = createClient(serverUrl, { transports: ["websocket"] });
    const playerTwo: TestSocket = createClient(serverUrl, { transports: ["websocket"] });

    try {
        await Promise.all([onceConnect(teacher), onceConnect(playerOne), onceConnect(playerTwo)]);
        const questionSetId = await createQuestionSet(teacher);
        const teacherCreated = await emitAck<{ ok: true; code: string }>(
            teacher,
            "teacher:createSession",
            { accessPin: "test-pin", questionSetId }
        );

        const joinedOne = await emitAck<{ ok: true }>(playerOne, "player:join", {
            code: teacherCreated.code,
            name: "Aru",
        });
        assert.equal(joinedOne.ok, true);

        const joinedTwo = await emitAck<{ ok: false; code: string }>(playerTwo, "player:join", {
            code: teacherCreated.code,
            name: "Dana",
        });
        assert.equal(joinedTwo.ok, false);
        assert.equal(joinedTwo.code, "SESSION_FULL");
    } finally {
        teacher.close();
        playerOne.close();
        playerTwo.close();
        await runtime.close();
    }
});
