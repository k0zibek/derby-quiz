import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createAppServer } from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const socketClientModule = await import(
    pathToFileURL(path.resolve(__dirname, "../../client/node_modules/socket.io-client/build/esm/index.js")).href
);
const { io: createClient } = socketClientModule;

function once(socket, eventName) {
    return new Promise((resolve) => {
        socket.once(eventName, resolve);
    });
}

function waitForState(socket, predicate) {
    return new Promise((resolve) => {
        const handler = (state) => {
            if (!predicate(state)) return;

            socket.off("session:state", handler);
            resolve(state);
        };

        socket.on("session:state", handler);
    });
}

function emitAck(socket, eventName, payload) {
    return new Promise((resolve) => {
        socket.emit(eventName, payload, resolve);
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

    await new Promise((resolve) => {
        runtime.server.listen(0, "127.0.0.1", resolve);
    });

    const address = runtime.server.address();
    const serverUrl = `http://127.0.0.1:${address.port}`;

    const teacher = createClient(serverUrl, { transports: ["websocket"] });
    const playerOne = createClient(serverUrl, { transports: ["websocket"] });
    const playerTwo = createClient(serverUrl, { transports: ["websocket"] });

    try {
        await Promise.all([
            once(teacher, "connect"),
            once(playerOne, "connect"),
            once(playerTwo, "connect"),
        ]);

        const deniedTeacher = await emitAck(teacher, "teacher:createSession", { accessPin: "bad-pin" });
        assert.equal(deniedTeacher.ok, false);
        assert.equal(deniedTeacher.code, "TEACHER_ACCESS_DENIED");

        const teacherCreated = await emitAck(teacher, "teacher:createSession", { accessPin: "test-pin" });
        assert.equal(teacherCreated.ok, true);

        const code = teacherCreated.code;
        const teacherToken = teacherCreated.teacherToken;
        const teacherStatePromise = waitForState(teacher, (state) => state.totalPlayers >= 1);
        const joinedOne = await emitAck(playerOne, "player:join", { code, name: "Aru" });
        const joinedTwo = await emitAck(playerTwo, "player:join", { code, name: "Dana" });

        assert.equal(joinedOne.ok, true);
        assert.equal(joinedTwo.ok, true);
        assert.ok(joinedOne.playerToken);
        assert.ok(joinedTwo.playerToken);

        const teacherState = await teacherStatePromise;
        assert.equal(teacherState.totalPlayers, 1);

        const unauthorizedTeacher = await emitAck(teacher, "teacher:startQuestion", {
            code,
            teacherToken: "bad-token",
        });
        assert.equal(unauthorizedTeacher.ok, false);
        assert.equal(unauthorizedTeacher.code, "UNAUTHORIZED");

        const startQuestion = await emitAck(teacher, "teacher:startQuestion", { code, teacherToken });
        assert.equal(startQuestion.ok, true);

        const [playerOneQuestion] = await Promise.all([
            once(playerOne, "session:state"),
            once(playerTwo, "session:state"),
        ]);
        assert.equal(playerOneQuestion.status, "question");

        const submitOne = await emitAck(playerOne, "player:submitAnswer", {
            code,
            playerId: joinedOne.playerId,
            playerToken: joinedOne.playerToken,
            optionIndex: 0,
        });
        const submitTwo = await emitAck(playerTwo, "player:submitAnswer", {
            code,
            playerId: joinedTwo.playerId,
            playerToken: joinedTwo.playerToken,
            optionIndex: 0,
        });

        assert.equal(submitOne.ok, true);
        assert.equal(submitTwo.ok, true);

        const unauthorizedPlayer = await emitAck(playerOne, "player:submitAnswer", {
            code,
            playerId: joinedOne.playerId,
            playerToken: "bad-token",
            optionIndex: 0,
        });
        assert.equal(unauthorizedPlayer.ok, false);
        assert.equal(unauthorizedPlayer.code, "UNAUTHORIZED");

        const showResults = await emitAck(teacher, "teacher:showResults", { code, teacherToken });
        assert.equal(showResults.ok, true);

        const nextQuestion = await emitAck(teacher, "teacher:nextQuestion", { code, teacherToken });
        assert.equal(nextQuestion.ok, true);
        assert.equal(nextQuestion.finished, false);
    } finally {
        teacher.close();
        playerOne.close();
        playerTwo.close();
        await runtime.close();
    }
});
