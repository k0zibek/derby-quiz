import { nanoid } from "nanoid";

import { questions as defaultQuestions } from "./questions.js";

export const GAME_STATUS = {
    LOBBY: "lobby",
    QUESTION: "question",
    RESULT: "result",
    FINISHED: "finished",
};

export function createError(code, error) {
    return { ok: false, code, error };
}

function createOk(payload = {}) {
    return { ok: true, ...payload };
}

function randomColor() {
    const colors = [
        "#ef4444",
        "#3b82f6",
        "#22c55e",
        "#eab308",
        "#a855f7",
        "#ec4899",
        "#14b8a6",
        "#f97316",
        "#8b5cf6",
        "#10b981",
        "#f43f5e",
        "#6366f1",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function safePlayerName(name) {
    if (typeof name !== "string") return "Игрок";
    const trimmed = name.trim().slice(0, 24);
    return trimmed || "Игрок";
}

function calculatePoints({ isCorrect }) {
    return isCorrect ? 10 : 0;
}

function calculateProgressDelta({ isCorrect }) {
    return isCorrect ? 10 : 0;
}

function getPublicQuestion(question) {
    if (!question) return null;

    return {
        id: question.id,
        text: question.text,
        options: question.options,
    };
}

function getTeacherQuestion(question) {
    if (!question) return null;

    return {
        id: question.id,
        text: question.text,
        options: question.options,
        correctIndex: question.correctIndex,
    };
}

function normalizePlayers(playersMap) {
    return Object.values(playersMap).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.joinedAt - b.joinedAt;
    });
}

function countAnswered(playersMap) {
    return Object.values(playersMap).filter((player) => player.answeredCurrent).length;
}

function getTeacherControls(status) {
    return {
        canStart: status === GAME_STATUS.LOBBY,
        canShowResults: status === GAME_STATUS.QUESTION,
        canGoNext: status === GAME_STATUS.RESULT,
        canReset: true,
    };
}

export function createSessionManager(options = {}) {
    const {
        initialQuestions = defaultQuestions,
        maxPlayersPerSession = 50,
        sessionTtlMs = 1000 * 60 * 60 * 4,
        now = () => Date.now(),
        createCode = () => nanoid(6).toUpperCase(),
        createPlayerId = () => nanoid(8),
    } = options;

    const sessions = Object.create(null);

    function cloneQuestions() {
        return initialQuestions.map((question) => ({
            id: question.id,
            text: question.text,
            options: [...question.options],
            correctIndex: question.correctIndex,
        }));
    }

    function getSession(code) {
        const session = sessions[code] || null;
        if (!session) return null;

        if (session.expiresAt <= now()) {
            delete sessions[code];
            return null;
        }

        return session;
    }

    function touchSession(session) {
        session.updatedAt = now();
        session.expiresAt = session.updatedAt + sessionTtlMs;
    }

    function resetPlayersForNewQuestion(session) {
        for (const player of Object.values(session.players)) {
            player.answeredCurrent = false;
            player.selectedOption = null;
            player.lastAnswerCorrect = null;
        }
    }

    function isSessionFinished(session) {
        return session.currentQuestionIndex >= session.questions.length;
    }

    function buildStateForTeacher(session) {
        const currentQuestion = session.questions[session.currentQuestionIndex] || null;
        const players = normalizePlayers(session.players);

        const optionStats = currentQuestion
            ? currentQuestion.options.map((optionText, index) => {
                let count = 0;
                for (const player of players) {
                    if (player.selectedOption === index) count += 1;
                }

                return {
                    index,
                    text: optionText,
                    count,
                    isCorrect: currentQuestion.correctIndex === index,
                };
            })
            : [];

        return {
            role: "teacher",
            code: session.code,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            totalQuestions: session.questions.length,
            currentQuestion: getTeacherQuestion(currentQuestion),
            players,
            answeredCount: countAnswered(session.players),
            totalPlayers: players.length,
            optionStats,
            ...getTeacherControls(session.status),
        };
    }

    function buildStateForPlayer(session, playerId) {
        const currentQuestion = session.questions[session.currentQuestionIndex] || null;
        const player = session.players[playerId] || null;

        return {
            role: "player",
            code: session.code,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            totalQuestions: session.questions.length,
            currentQuestion: session.status === GAME_STATUS.QUESTION ? getPublicQuestion(currentQuestion) : null,
            player,
        };
    }

    function buildStateForScreen(session) {
        const currentQuestion = session.questions[session.currentQuestionIndex] || null;

        return {
            role: "screen",
            code: session.code,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            totalQuestions: session.questions.length,
            currentQuestion:
                session.status === GAME_STATUS.QUESTION || session.status === GAME_STATUS.RESULT
                    ? getPublicQuestion(currentQuestion)
                    : null,
            players: normalizePlayers(session.players),
            answeredCount: countAnswered(session.players),
            totalPlayers: Object.keys(session.players).length,
        };
    }

    function createSession() {
        const code = createCode();
        const timestamp = now();

        sessions[code] = {
            code,
            createdAt: timestamp,
            updatedAt: timestamp,
            expiresAt: timestamp + sessionTtlMs,
            status: GAME_STATUS.LOBBY,
            teacherSocketId: null,
            screenSocketId: null,
            currentQuestionIndex: 0,
            questions: cloneQuestions(),
            players: Object.create(null),
        };

        return createOk({ code, session: sessions[code] });
    }

    function attachTeacher(code, socketId) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        session.teacherSocketId = socketId;
        touchSession(session);
        return createOk({ session });
    }

    function attachScreen(code, socketId) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        session.screenSocketId = socketId;
        touchSession(session);
        return createOk({ session });
    }

    function joinPlayer({ code, name, socketId }) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        const totalPlayers = Object.keys(session.players).length;
        if (totalPlayers >= maxPlayersPerSession) {
            return createError("SESSION_FULL", "Session is full");
        }

        const playerId = createPlayerId();
        session.players[playerId] = {
            id: playerId,
            socketId,
            name: safePlayerName(name),
            score: 0,
            progress: 0,
            color: randomColor(),
            connected: true,
            answeredCurrent: false,
            selectedOption: null,
            lastAnswerCorrect: null,
            joinedAt: now(),
        };

        touchSession(session);
        return createOk({ playerId, session });
    }

    function rejoinPlayer({ code, playerId, socketId }) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        const player = session.players[playerId];
        if (!player) {
            return createError("PLAYER_NOT_FOUND", "Player not found");
        }

        player.socketId = socketId;
        player.connected = true;
        touchSession(session);

        return createOk({ playerId, session, playerState: buildStateForPlayer(session, playerId) });
    }

    function startQuestion(code) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        if (isSessionFinished(session)) {
            session.status = GAME_STATUS.FINISHED;
            touchSession(session);
            return createError("GAME_ALREADY_FINISHED", "Game already finished");
        }

        if (session.status !== GAME_STATUS.LOBBY) {
            return createError("INVALID_TRANSITION", "Question can only be started from lobby");
        }

        resetPlayersForNewQuestion(session);
        session.status = GAME_STATUS.QUESTION;
        touchSession(session);

        return createOk({ session });
    }

    function submitAnswer({ code, playerId, optionIndex }) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        if (session.status !== GAME_STATUS.QUESTION) {
            return createError("QUESTION_NOT_ACTIVE", "Question is not active");
        }

        const player = session.players[playerId];
        if (!player) {
            return createError("PLAYER_NOT_FOUND", "Player not found");
        }

        if (player.answeredCurrent) {
            return createError("ALREADY_ANSWERED", "You already answered this question");
        }

        const question = session.questions[session.currentQuestionIndex];
        if (!question) {
            return createError("QUESTION_NOT_FOUND", "Question not found");
        }

        const normalizedOptionIndex = Number(optionIndex);
        if (
            Number.isNaN(normalizedOptionIndex) ||
            normalizedOptionIndex < 0 ||
            normalizedOptionIndex >= question.options.length
        ) {
            return createError("INVALID_OPTION_INDEX", "Invalid option index");
        }

        const isCorrect = question.correctIndex === normalizedOptionIndex;
        const points = calculatePoints({ isCorrect });
        const progressDelta = calculateProgressDelta({ isCorrect });

        player.answeredCurrent = true;
        player.selectedOption = normalizedOptionIndex;
        player.lastAnswerCorrect = isCorrect;
        player.score += points;
        player.progress = clamp(player.progress + progressDelta, 0, 100);

        touchSession(session);
        return createOk({
            isCorrect,
            points,
            totalScore: player.score,
            progress: player.progress,
            session,
        });
    }

    function showResults(code) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        if (session.status !== GAME_STATUS.QUESTION) {
            return createError("INVALID_TRANSITION", "Results can only be shown for an active question");
        }

        session.status = GAME_STATUS.RESULT;
        touchSession(session);
        return createOk({ session });
    }

    function nextQuestion(code) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        if (session.status !== GAME_STATUS.RESULT) {
            return createError("INVALID_TRANSITION", "Next question can only be opened from results");
        }

        session.currentQuestionIndex += 1;

        if (isSessionFinished(session)) {
            session.status = GAME_STATUS.FINISHED;
            touchSession(session);
            return createOk({ finished: true, session });
        }

        resetPlayersForNewQuestion(session);
        session.status = GAME_STATUS.LOBBY;
        touchSession(session);

        return createOk({ finished: false, session });
    }

    function resetGame(code) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        session.status = GAME_STATUS.LOBBY;
        session.currentQuestionIndex = 0;

        for (const player of Object.values(session.players)) {
            player.score = 0;
            player.progress = 0;
            player.answeredCurrent = false;
            player.selectedOption = null;
            player.lastAnswerCorrect = null;
        }

        touchSession(session);
        return createOk({ session });
    }

    function getTeacherState(code) {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        return createOk({ state: buildStateForTeacher(session), session });
    }

    function markDisconnected({ code, role, playerId }) {
        const session = getSession(code);
        if (!session) return;

        if (role === "player" && playerId && session.players[playerId]) {
            session.players[playerId].connected = false;
            session.players[playerId].socketId = null;
        }

        if (role === "teacher") {
            session.teacherSocketId = null;
        }

        if (role === "screen") {
            session.screenSocketId = null;
        }

        touchSession(session);
    }

    function cleanupExpiredSessions() {
        const currentTime = now();
        let removedCount = 0;

        for (const [code, session] of Object.entries(sessions)) {
            if (session.expiresAt <= currentTime) {
                delete sessions[code];
                removedCount += 1;
            }
        }

        return removedCount;
    }

    function snapshot(code) {
        const session = getSession(code);
        if (!session) return null;

        return {
            teacher: buildStateForTeacher(session),
            screen: buildStateForScreen(session),
            players: Object.values(session.players).reduce((acc, player) => {
                acc[player.id] = buildStateForPlayer(session, player.id);
                return acc;
            }, Object.create(null)),
        };
    }

    return {
        GAME_STATUS,
        sessions,
        getSession,
        createSession,
        attachTeacher,
        attachScreen,
        joinPlayer,
        rejoinPlayer,
        startQuestion,
        submitAnswer,
        showResults,
        nextQuestion,
        resetGame,
        getTeacherState,
        markDisconnected,
        cleanupExpiredSessions,
        snapshot,
    };
}
