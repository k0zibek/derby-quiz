import type {
    AckResponse,
    ConnectionState,
    ErrorResponse,
    NextQuestionAck,
    QuestionSetAck,
    QuestionSetDraft,
    QuestionSetListAck,
    PlayerJoinAck,
    PlayerRejoinAck,
    SessionState,
    SimpleAck,
    SubmitAnswerAck,
    TeacherCreateSessionAck,
} from "../../shared/types";
import { SERVER_URL, socket } from "./socket";

const CONNECT_TIMEOUT_MS = 5000;
const ACK_TIMEOUT_MS = 5000;

type ConnectionEvent =
    | { type: "connect"; state: "connected" }
    | { type: "disconnect"; state: "disconnected"; reason: string }
    | { type: "connect_error"; state: "connecting" | "disconnected"; error: string };

type AckEmitter<T> = {
    timeout: (timeoutMs: number) => {
        emit: (
            eventName: string,
            payload: object,
            callback: (error: Error | null, response: T | undefined) => void
        ) => void;
    };
};

function createError(code: string, error: string): ErrorResponse {
    return { ok: false, code, error };
}

function getConnectionState(): ConnectionState {
    if (socket.connected) return "connected";
    if (socket.active) return "connecting";
    return "disconnected";
}

function ensureConnected(timeoutMs = CONNECT_TIMEOUT_MS): Promise<AckResponse> {
    if (socket.connected) {
        return Promise.resolve({ ok: true });
    }

    return new Promise((resolve) => {
        let lastConnectError = "";

        const timeoutId = globalThis.setTimeout(() => {
            cleanup();
            if (lastConnectError) {
                resolve(createError("SOCKET_CONNECT_ERROR", lastConnectError));
                return;
            }

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

        function handleConnectError(error: Error) {
            lastConnectError = error.message || "Failed to connect to the game server";
        }

        socket.on("connect", handleConnect);
        socket.on("connect_error", handleConnectError);
        socket.connect();
    });
}

async function emitWithAck<T extends AckResponse>(eventName: string, payload: object): Promise<T | ErrorResponse> {
    const connection = await ensureConnected();
    if (!connection.ok) {
        return connection;
    }

    return new Promise((resolve) => {
        (socket as unknown as AckEmitter<T>)
            .timeout(ACK_TIMEOUT_MS)
            .emit(eventName, payload, (error, response) => {
            if (error) {
                resolve(createError("ACK_TIMEOUT", "The server did not respond in time"));
                return;
            }

            resolve(response ?? createError("NO_RESPONSE", "No response from server"));
        });
    });
}

function subscribeToSessionState(handler: (state: SessionState) => void): () => void {
    socket.on("session:state", handler);

    return () => {
        socket.off("session:state", handler);
    };
}

function subscribeToConnection(handler: (event: ConnectionEvent) => void): () => void {
    function handleConnect() {
        handler({ type: "connect", state: "connected" });
    }

    function handleDisconnect(reason: string) {
        handler({ type: "disconnect", state: "disconnected", reason });
    }

    function handleConnectError(error: Error) {
        handler({
            type: "connect_error",
            state: socket.active ? "connecting" : "disconnected",
            error: error.message || "Failed to connect to the game server",
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
    listQuestionSets(accessPin: string) {
        return emitWithAck<QuestionSetListAck>("questionSet:list", { accessPin });
    },
    createQuestionSet(accessPin: string, questionSet: QuestionSetDraft) {
        return emitWithAck<QuestionSetAck>("questionSet:create", { accessPin, questionSet });
    },
    getQuestionSet(accessPin: string, questionSetId: string) {
        return emitWithAck<QuestionSetAck>("questionSet:get", { accessPin, questionSetId });
    },
    updateQuestionSet(accessPin: string, questionSetId: string, questionSet: QuestionSetDraft) {
        return emitWithAck<QuestionSetAck>("questionSet:update", { accessPin, questionSetId, questionSet });
    },
    deleteQuestionSet(accessPin: string, questionSetId: string) {
        return emitWithAck<SimpleAck>("questionSet:delete", { accessPin, questionSetId });
    },
    createTeacherSession(accessPin: string, questionSetId: string) {
        return emitWithAck<TeacherCreateSessionAck>("teacher:createSession", { accessPin, questionSetId });
    },
    joinTeacherSession(code: string, teacherToken: string) {
        return emitWithAck<SimpleAck>("teacher:joinSession", { code, teacherToken });
    },
    joinScreen(code: string) {
        return emitWithAck<SimpleAck>("screen:join", { code });
    },
    joinPlayer(code: string, name: string) {
        return emitWithAck<PlayerJoinAck>("player:join", { code, name });
    },
    rejoinPlayer(code: string, playerId: string, playerToken: string) {
        return emitWithAck<PlayerRejoinAck>("player:rejoin", { code, playerId, playerToken });
    },
    startQuestion(code: string, teacherToken: string) {
        return emitWithAck<SimpleAck>("teacher:startQuestion", { code, teacherToken });
    },
    showResults(code: string, teacherToken: string) {
        return emitWithAck<SimpleAck>("teacher:showResults", { code, teacherToken });
    },
    nextQuestion(code: string, teacherToken: string) {
        return emitWithAck<NextQuestionAck>("teacher:nextQuestion", { code, teacherToken });
    },
    resetGame(code: string, teacherToken: string) {
        return emitWithAck<SimpleAck>("teacher:resetGame", { code, teacherToken });
    },
    addQuestion(code: string, teacherToken: string, question: QuestionSetDraft["questions"][number]) {
        return emitWithAck<SimpleAck>("session:addQuestion", { code, teacherToken, question });
    },
    submitAnswer(code: string, playerId: string, playerToken: string, optionIndex: number) {
        return emitWithAck<SubmitAnswerAck>("player:submitAnswer", { code, playerId, playerToken, optionIndex });
    },
};
