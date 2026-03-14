const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

/**
 * In-memory storage
 *
 * sessions = {
 *   [code]: {
 *     code: string,
 *     createdAt: number,
 *     status: "lobby" | "question" | "result" | "finished",
 *     teacherSocketId: string | null,
 *     screenSocketId: string | null,
 *     currentQuestionIndex: number,
 *     questions: Question[],
 *     players: {
 *       [playerId]: Player
 *     }
 *   }
 * }
 */
const sessions = Object.create(null);

/**
 * Default questions for MVP
 * Later you can move this to JSON
 */
function getDefaultQuestions() {
    return [
        {
            id: "q1",
            text: "Сколько будет 2 + 2?",
            options: ["3", "4", "5", "6"],
            correctIndex: 1,
        },
        {
            id: "q2",
            text: "Столица Казахстана?",
            options: ["Алматы", "Астана", "Шымкент", "Караганда"],
            correctIndex: 1,
        },
        {
            id: "q3",
            text: "Какой язык работает в браузере?",
            options: ["Python", "Java", "JavaScript", "C++"],
            correctIndex: 2,
        },
        {
            id: "q4",
            text: "Сколько дней в неделе?",
            options: ["5", "6", "7", "8"],
            correctIndex: 2,
        },
        {
            id: "q5",
            text: "Какого цвета трава?",
            options: ["Синяя", "Зеленая", "Красная", "Черная"],
            correctIndex: 1,
        },
    ];
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

function getSession(code) {
    return sessions[code] || null;
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
    return Object.values(playersMap).filter((p) => p.answeredCurrent).length;
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
        currentQuestion: session.status === "question" ? getPublicQuestion(currentQuestion) : null,
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
            session.status === "question" || session.status === "result"
                ? getPublicQuestion(currentQuestion)
                : null,
        players: normalizePlayers(session.players),
        answeredCount: countAnswered(session.players),
        totalPlayers: Object.keys(session.players).length,
    };
}

function emitTeacherState(code) {
    const session = getSession(code);
    if (!session) return;

    io.to(`teacher:${code}`).emit("session:state", buildStateForTeacher(session));
}

function emitScreenState(code) {
    const session = getSession(code);
    if (!session) return;

    io.to(`screen:${code}`).emit("session:state", buildStateForScreen(session));
}

function emitPlayersState(code) {
    const session = getSession(code);
    if (!session) return;

    for (const player of Object.values(session.players)) {
        if (!player.socketId) continue;
        io.to(player.socketId).emit("session:state", buildStateForPlayer(session, player.id));
    }
}

function emitAllState(code) {
    emitTeacherState(code);
    emitScreenState(code);
    emitPlayersState(code);
}

function resetPlayersForNewQuestion(session) {
    for (const player of Object.values(session.players)) {
        player.answeredCurrent = false;
        player.selectedOption = null;
        player.lastAnswerCorrect = null;
    }
}

function createSession() {
    const code = nanoid(6).toUpperCase();

    sessions[code] = {
        code,
        createdAt: Date.now(),
        status: "lobby",
        teacherSocketId: null,
        screenSocketId: null,
        currentQuestionIndex: 0,
        questions: getDefaultQuestions(),
        players: Object.create(null),
    };

    return sessions[code];
}

function isSessionFinished(session) {
    return session.currentQuestionIndex >= session.questions.length;
}

function safePlayerName(name) {
    if (typeof name !== "string") return "Игрок";
    const trimmed = name.trim().slice(0, 24);
    return trimmed || "Игрок";
}

function calculatePoints({ isCorrect }) {
    if (!isCorrect) return 0;
    return 10;
}

function calculateProgressDelta({ isCorrect }) {
    if (!isCorrect) return 0;
    return 10;
}

app.get("/", (_, res) => {
    res.json({
        ok: true,
        message: "Kahoot horses server is running",
    });
});

app.get("/health", (_, res) => {
    res.json({ ok: true });
});

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    /**
     * Teacher creates a new session
     */
    socket.on("teacher:createSession", (_, callback) => {
        try {
            const session = createSession();

            session.teacherSocketId = socket.id;

            socket.data.role = "teacher";
            socket.data.code = session.code;

            socket.join(`teacher:${session.code}`);

            callback?.({
                ok: true,
                code: session.code,
            });

            emitAllState(session.code);
        } catch (error) {
            console.error("teacher:createSession error:", error);
            callback?.({
                ok: false,
                error: "Failed to create session",
            });
        }
    });

    /**
     * Teacher reconnects to an existing session
     */
    socket.on("teacher:joinSession", ({ code }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            session.teacherSocketId = socket.id;

            socket.data.role = "teacher";
            socket.data.code = code;

            socket.join(`teacher:${code}`);

            callback?.({ ok: true });
            emitAllState(code);
        } catch (error) {
            console.error("teacher:joinSession error:", error);
            callback?.({
                ok: false,
                error: "Failed to join teacher session",
            });
        }
    });

    /**
     * Big screen joins
     */
    socket.on("screen:join", ({ code }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            session.screenSocketId = socket.id;

            socket.data.role = "screen";
            socket.data.code = code;

            socket.join(`screen:${code}`);

            callback?.({ ok: true });
            emitAllState(code);
        } catch (error) {
            console.error("screen:join error:", error);
            callback?.({
                ok: false,
                error: "Failed to join screen",
            });
        }
    });

    /**
     * Player joins session
     */
    socket.on("player:join", ({ code, name }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            const totalPlayers = Object.keys(session.players).length;
            if (totalPlayers >= 50) {
                return callback?.({
                    ok: false,
                    error: "Session is full",
                });
            }

            const playerId = nanoid(8);
            const player = {
                id: playerId,
                socketId: socket.id,
                name: safePlayerName(name),
                score: 0,
                progress: 0,
                color: randomColor(),
                connected: true,
                answeredCurrent: false,
                selectedOption: null,
                lastAnswerCorrect: null,
                joinedAt: Date.now(),
            };

            session.players[playerId] = player;

            socket.data.role = "player";
            socket.data.code = code;
            socket.data.playerId = playerId;

            callback?.({
                ok: true,
                playerId,
            });

            emitAllState(code);
        } catch (error) {
            console.error("player:join error:", error);
            callback?.({
                ok: false,
                error: "Failed to join session",
            });
        }
    });

    /**
     * Player rejoin
     * Useful after page refresh if client stores playerId
     */
    socket.on("player:rejoin", ({ code, playerId }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            const player = session.players[playerId];
            if (!player) {
                return callback?.({
                    ok: false,
                    error: "Player not found",
                });
            }

            player.socketId = socket.id;
            player.connected = true;

            socket.data.role = "player";
            socket.data.code = code;
            socket.data.playerId = playerId;

            callback?.({
                ok: true,
                playerId,
            });

            emitAllState(code);
        } catch (error) {
            console.error("player:rejoin error:", error);
            callback?.({
                ok: false,
                error: "Failed to rejoin session",
            });
        }
    });

    /**
     * Teacher starts current question
     */
    socket.on("teacher:startQuestion", ({ code }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            if (isSessionFinished(session)) {
                session.status = "finished";
                emitAllState(code);
                return callback?.({
                    ok: false,
                    error: "Game already finished",
                });
            }

            resetPlayersForNewQuestion(session);
            session.status = "question";

            callback?.({ ok: true });
            emitAllState(code);
        } catch (error) {
            console.error("teacher:startQuestion error:", error);
            callback?.({
                ok: false,
                error: "Failed to start question",
            });
        }
    });

    /**
     * Player submits answer
     */
    socket.on("player:submitAnswer", ({ code, playerId, optionIndex }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            if (session.status !== "question") {
                return callback?.({
                    ok: false,
                    error: "Question is not active",
                });
            }

            const player = session.players[playerId];
            if (!player) {
                return callback?.({
                    ok: false,
                    error: "Player not found",
                });
            }

            if (player.answeredCurrent) {
                return callback?.({
                    ok: false,
                    error: "You already answered this question",
                });
            }

            const question = session.questions[session.currentQuestionIndex];
            if (!question) {
                return callback?.({
                    ok: false,
                    error: "Question not found",
                });
            }

            const normalizedOptionIndex = Number(optionIndex);

            if (
                Number.isNaN(normalizedOptionIndex) ||
                normalizedOptionIndex < 0 ||
                normalizedOptionIndex >= question.options.length
            ) {
                return callback?.({
                    ok: false,
                    error: "Invalid option index",
                });
            }

            const isCorrect = question.correctIndex === normalizedOptionIndex;
            const points = calculatePoints({ isCorrect });
            const progressDelta = calculateProgressDelta({ isCorrect });

            player.answeredCurrent = true;
            player.selectedOption = normalizedOptionIndex;
            player.lastAnswerCorrect = isCorrect;
            player.score += points;
            player.progress = clamp(player.progress + progressDelta, 0, 100);

            callback?.({
                ok: true,
                isCorrect,
                points,
                totalScore: player.score,
                progress: player.progress,
            });

            emitAllState(code);
        } catch (error) {
            console.error("player:submitAnswer error:", error);
            callback?.({
                ok: false,
                error: "Failed to submit answer",
            });
        }
    });

    /**
     * Teacher shows results for current question
     */
    socket.on("teacher:showResults", ({ code }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            session.status = "result";

            callback?.({ ok: true });
            emitAllState(code);
        } catch (error) {
            console.error("teacher:showResults error:", error);
            callback?.({
                ok: false,
                error: "Failed to show results",
            });
        }
    });

    /**
     * Teacher goes to next question
     */
    socket.on("teacher:nextQuestion", ({ code }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            session.currentQuestionIndex += 1;

            if (isSessionFinished(session)) {
                session.status = "finished";

                callback?.({
                    ok: true,
                    finished: true,
                });

                emitAllState(code);
                return;
            }

            resetPlayersForNewQuestion(session);
            session.status = "lobby";

            callback?.({
                ok: true,
                finished: false,
            });

            emitAllState(code);
        } catch (error) {
            console.error("teacher:nextQuestion error:", error);
            callback?.({
                ok: false,
                error: "Failed to move to next question",
            });
        }
    });

    /**
     * Optional full reset of game state
     */
    socket.on("teacher:resetGame", ({ code }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            session.status = "lobby";
            session.currentQuestionIndex = 0;

            for (const player of Object.values(session.players)) {
                player.score = 0;
                player.progress = 0;
                player.answeredCurrent = false;
                player.selectedOption = null;
                player.lastAnswerCorrect = null;
            }

            callback?.({ ok: true });
            emitAllState(code);
        } catch (error) {
            console.error("teacher:resetGame error:", error);
            callback?.({
                ok: false,
                error: "Failed to reset game",
            });
        }
    });

    /**
     * Debug endpoint via socket
     */
    socket.on("session:getState", ({ code }, callback) => {
        try {
            const session = getSession(code);

            if (!session) {
                return callback?.({
                    ok: false,
                    error: "Session not found",
                });
            }

            callback?.({
                ok: true,
                state: buildStateForTeacher(session),
            });
        } catch (error) {
            console.error("session:getState error:", error);
            callback?.({
                ok: false,
                error: "Failed to get session state",
            });
        }
    });

    socket.on("disconnect", () => {
        try {
            const { role, code, playerId } = socket.data || {};

            if (role === "player" && code && playerId) {
                const session = getSession(code);
                if (session && session.players[playerId]) {
                    session.players[playerId].connected = false;
                    session.players[playerId].socketId = null;
                    emitAllState(code);
                }
            }

            if (role === "teacher" && code) {
                const session = getSession(code);
                if (session) {
                    session.teacherSocketId = null;
                    emitAllState(code);
                }
            }

            if (role === "screen" && code) {
                const session = getSession(code);
                if (session) {
                    session.screenSocketId = null;
                    emitAllState(code);
                }
            }

            console.log(`Socket disconnected: ${socket.id}`);
        } catch (error) {
            console.error("disconnect error:", error);
        }
    });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
