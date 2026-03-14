import { socket } from "./socket";

function emitWithAck(eventName, payload = {}) {
    return new Promise((resolve) => {
        socket.emit(eventName, payload, (response) => {
            resolve(response || { ok: false, code: "NO_RESPONSE", error: "No response from server" });
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
    socket.on("connect", handler);
    socket.on("disconnect", handler);

    return () => {
        socket.off("connect", handler);
        socket.off("disconnect", handler);
    };
}

export const sessionClient = {
    socket,
    subscribeToSessionState,
    subscribeToConnection,
    createTeacherSession() {
        return emitWithAck("teacher:createSession");
    },
    joinTeacherSession(code) {
        return emitWithAck("teacher:joinSession", { code });
    },
    joinScreen(code) {
        return emitWithAck("screen:join", { code });
    },
    joinPlayer(code, name) {
        return emitWithAck("player:join", { code, name });
    },
    rejoinPlayer(code, playerId) {
        return emitWithAck("player:rejoin", { code, playerId });
    },
    startQuestion(code) {
        return emitWithAck("teacher:startQuestion", { code });
    },
    showResults(code) {
        return emitWithAck("teacher:showResults", { code });
    },
    nextQuestion(code) {
        return emitWithAck("teacher:nextQuestion", { code });
    },
    resetGame(code) {
        return emitWithAck("teacher:resetGame", { code });
    },
    submitAnswer(code, playerId, optionIndex) {
        return emitWithAck("player:submitAnswer", { code, playerId, optionIndex });
    },
};
