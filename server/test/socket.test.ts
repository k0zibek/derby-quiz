import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { io as createClient, type Socket as ClientSocket } from "socket.io-client";

import type { ClientToServerEvents, ServerToClientEvents, SessionState } from "../../shared/types.js";
import { createAppServer } from "../index.js";

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;
type AckEmitter = {
    emit: (eventName: string, payload: object, callback: (response: unknown) => void) => void;
};

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

test("socket flow covers teacher, players, results, and finish", async () => {
    const runtime = createAppServer({
        config: {
            port: 0,
            clientOrigins: "*",
            maxPlayersPerSession: 50,
            sessionTtlMs: 1000 * 60 * 60,
            cleanupIntervalMs: 1000 * 60 * 60,
            teacherAccessPin: "test-pin",
            teacherAccessPinIsGenerated: false,
        },
    });

    await new Promise<void>((resolve) => {
        runtime.server.listen(0, "127.0.0.1", resolve);
    });

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
            { accessPin: "bad-pin" }
        );
        assert.equal(deniedTeacher.ok, false);
        assert.equal(deniedTeacher.code, "TEACHER_ACCESS_DENIED");

        const teacherCreated = await emitAck<{ ok: true; code: string; teacherToken: string }>(
            teacher,
            "teacher:createSession",
            { accessPin: "test-pin" }
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
        assert.equal(invalidOption.code, "ALREADY_ANSWERED");

        const showResults = await emitAck<{ ok: true }>(
            teacher,
            "teacher:showResults",
            { code, teacherToken }
        );
        assert.equal(showResults.ok, true);

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

test("socket flow returns SESSION_FULL when max players is reached", async () => {
    const runtime = createAppServer({
        config: {
            port: 0,
            clientOrigins: "*",
            maxPlayersPerSession: 1,
            sessionTtlMs: 1000 * 60 * 60,
            cleanupIntervalMs: 1000 * 60 * 60,
            teacherAccessPin: "test-pin",
            teacherAccessPinIsGenerated: false,
        },
    });

    await new Promise<void>((resolve) => {
        runtime.server.listen(0, "127.0.0.1", resolve);
    });

    const address = runtime.server.address();
    assert.ok(address && typeof address !== "string");
    const serverUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    const teacher: TestSocket = createClient(serverUrl, { transports: ["websocket"] });
    const playerOne: TestSocket = createClient(serverUrl, { transports: ["websocket"] });
    const playerTwo: TestSocket = createClient(serverUrl, { transports: ["websocket"] });

    try {
        await Promise.all([onceConnect(teacher), onceConnect(playerOne), onceConnect(playerTwo)]);
        const teacherCreated = await emitAck<{ ok: true; code: string }>(
            teacher,
            "teacher:createSession",
            { accessPin: "test-pin" }
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
