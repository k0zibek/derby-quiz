import { SERVER_URL, socket } from "./socket";

const CONNECT_TIMEOUT_MS = 5000;
const ACK_TIMEOUT_MS = 5000;

function createError(code, error) {
    return { ok: false, code, error };
}

function getConnectionState() {
    if (socket.connected) return "connected";
    if (socket.active) return "connecting";
    return "disconnected";
}

function ensureConnected(timeoutMs = CONNECT_TIMEOUT_MS) {
    if (socket.connected) {
        return Promise.resolve({ ok: true });
    }

    return new Promise((resolve) => {
        const timeoutId = globalThis.setTimeout(() => {
            cleanup();
            resolve(createError("SOCKET_CONNECT_TIMEOUT", "Timed out while connecting to the game server"));
        }, timeoutMs);

        function cleanup() {
            globalThis.clearTimeout(timeoutId);
            socket.off("connect", handleConnect);
            socket.off("connect_error", handleConnectError);
        }

        function handleConnect() {
            cleanup();
            resolve({ ok: true });
        }

        function handleConnectError(error) {
            cleanup();
            resolve(createError("SOCKET_CONNECT_ERROR", error?.message || "Failed to connect to the game server"));
        }

        socket.on("connect", handleConnect);
        socket.on("connect_error", handleConnectError);
        socket.connect();
    });
}

async function emitWithAck(eventName, payload = {}) {
    const connection = await ensureConnected();
    if (!connection.ok) {
        return connection;
    }

    return new Promise((resolve) => {
        socket.timeout(ACK_TIMEOUT_MS).emit(eventName, payload, (error, response) => {
            if (error) {
                resolve(createError("ACK_TIMEOUT", "The server did not respond in time"));
                return;
            }

            resolve(response || createError("NO_RESPONSE", "No response from server"));
        });
    });
}

function subscribeToSessionState(handler) {
    socket.on("session:state", handler);

    return () => {
        socket.off("session:state", handler);
    };
}

function subscribeToConnection(handler) {
    function handleConnect() {
        handler({ type: "connect", state: "connected" });
    }

    function handleDisconnect(reason) {
        handler({ type: "disconnect", state: "disconnected", reason });
    }

    function handleConnectError(error) {
        handler({
            type: "connect_error",
            state: socket.active ? "connecting" : "disconnected",
            error: error?.message || "Failed to connect to the game server",
        });
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("connect_error", handleConnectError);
    };
}

export const sessionClient = {
    socket,
    serverUrl: SERVER_URL,
    getConnectionState,
    ensureConnected,
    subscribeToSessionState,
    subscribeToConnection,
    createTeacherSession(accessPin) {
        return emitWithAck("teacher:createSession", { accessPin });
    },
    joinTeacherSession(code, teacherToken) {
        return emitWithAck("teacher:joinSession", { code, teacherToken });
    },
    joinScreen(code) {
        return emitWithAck("screen:join", { code });
    },
    joinPlayer(code, name) {
        return emitWithAck("player:join", { code, name });
    },
    rejoinPlayer(code, playerId, playerToken) {
        return emitWithAck("player:rejoin", { code, playerId, playerToken });
    },
    startQuestion(code, teacherToken) {
        return emitWithAck("teacher:startQuestion", { code, teacherToken });
    },
    showResults(code, teacherToken) {
        return emitWithAck("teacher:showResults", { code, teacherToken });
    },
    nextQuestion(code, teacherToken) {
        return emitWithAck("teacher:nextQuestion", { code, teacherToken });
    },
    resetGame(code, teacherToken) {
        return emitWithAck("teacher:resetGame", { code, teacherToken });
    },
    submitAnswer(code, playerId, playerToken, optionIndex) {
        return emitWithAck("player:submitAnswer", { code, playerId, playerToken, optionIndex });
    },
};
