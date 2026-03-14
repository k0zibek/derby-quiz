import cors from "cors";
import express from "express";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { Server } from "socket.io";

import { loadConfig } from "./config.js";
import { createSessionManager } from "./game.js";

function createCorsOriginMatcher(origins) {
    if (origins === "*") return "*";

    return function corsOrigin(origin, callback) {
        if (!origin || origins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("Origin is not allowed by CORS"));
    };
}

export function createAppServer(options = {}) {
    const config = options.config || loadConfig();
    const app = express();
    const server = http.createServer(app);
    const sessionManager = options.sessionManager || createSessionManager({
        maxPlayersPerSession: config.maxPlayersPerSession,
        sessionTtlMs: config.sessionTtlMs,
    });

    app.use(cors({
        origin: createCorsOriginMatcher(config.clientOrigins),
    }));
    app.use(express.json());

    const io = new Server(server, {
        cors: {
            origin: createCorsOriginMatcher(config.clientOrigins),
            methods: ["GET", "POST"],
        },
    });

    app.get("/", (_, res) => {
        res.json({
            ok: true,
            message: "Kahoot horses server is running",
        });
    });

    app.get("/health", (_, res) => {
        const activeSessions = Object.keys(sessionManager.sessions).length;

        res.json({
            ok: true,
            status: "healthy",
            activeSessions,
            uptimeSeconds: Math.round(process.uptime()),
        });
    });

    app.get("/ready", (_, res) => {
        res.json({
            ok: true,
            status: "ready",
            activeSessions: Object.keys(sessionManager.sessions).length,
        });
    });

    function emitAllState(code) {
        const session = sessionManager.getSession(code);
        if (!session) return;

        const snapshot = sessionManager.snapshot(code);
        io.to(`teacher:${code}`).emit("session:state", snapshot.teacher);
        io.to(`screen:${code}`).emit("session:state", snapshot.screen);

        for (const player of Object.values(session.players)) {
            if (!player.socketId) continue;
            io.to(player.socketId).emit("session:state", snapshot.players[player.id]);
        }
    }

    function bindRole(socket, roleData) {
        Object.assign(socket.data, roleData);
    }

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        socket.on("teacher:createSession", (_, callback) => {
            try {
                const result = sessionManager.createSession();
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                const attachResult = sessionManager.attachTeacher(result.code, socket.id);
                if (!attachResult.ok) {
                    callback?.(attachResult);
                    return;
                }

                bindRole(socket, { role: "teacher", code: result.code });
                socket.join(`teacher:${result.code}`);
                callback?.({ ok: true, code: result.code });
                emitAllState(result.code);
            } catch (error) {
                console.error("teacher:createSession error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to create session",
                });
            }
        });

        socket.on("teacher:joinSession", ({ code }, callback) => {
            try {
                const result = sessionManager.attachTeacher(code, socket.id);
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                bindRole(socket, { role: "teacher", code });
                socket.join(`teacher:${code}`);
                callback?.({ ok: true });
                emitAllState(code);
            } catch (error) {
                console.error("teacher:joinSession error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to join teacher session",
                });
            }
        });

        socket.on("screen:join", ({ code }, callback) => {
            try {
                const result = sessionManager.attachScreen(code, socket.id);
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                bindRole(socket, { role: "screen", code });
                socket.join(`screen:${code}`);
                callback?.({ ok: true });
                emitAllState(code);
            } catch (error) {
                console.error("screen:join error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to join screen",
                });
            }
        });

        socket.on("player:join", ({ code, name }, callback) => {
            try {
                const result = sessionManager.joinPlayer({ code, name, socketId: socket.id });
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                bindRole(socket, { role: "player", code, playerId: result.playerId });
                callback?.({ ok: true, playerId: result.playerId });
                emitAllState(code);
            } catch (error) {
                console.error("player:join error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to join session",
                });
            }
        });

        socket.on("player:rejoin", ({ code, playerId }, callback) => {
            try {
                const result = sessionManager.rejoinPlayer({ code, playerId, socketId: socket.id });
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                bindRole(socket, { role: "player", code, playerId });
                callback?.({
                    ok: true,
                    playerId,
                    state: result.playerState,
                });
                emitAllState(code);
            } catch (error) {
                console.error("player:rejoin error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to rejoin session",
                });
            }
        });

        socket.on("teacher:startQuestion", ({ code }, callback) => {
            try {
                const result = sessionManager.startQuestion(code);
                callback?.(result.ok ? { ok: true } : result);
                if (result.ok || result.code === "GAME_ALREADY_FINISHED") {
                    emitAllState(code);
                }
            } catch (error) {
                console.error("teacher:startQuestion error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to start question",
                });
            }
        });

        socket.on("player:submitAnswer", ({ code, playerId, optionIndex }, callback) => {
            try {
                const result = sessionManager.submitAnswer({ code, playerId, optionIndex });
                callback?.(result);
                if (result.ok) {
                    emitAllState(code);
                }
            } catch (error) {
                console.error("player:submitAnswer error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to submit answer",
                });
            }
        });

        socket.on("teacher:showResults", ({ code }, callback) => {
            try {
                const result = sessionManager.showResults(code);
                callback?.(result.ok ? { ok: true } : result);
                if (result.ok) {
                    emitAllState(code);
                }
            } catch (error) {
                console.error("teacher:showResults error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to show results",
                });
            }
        });

        socket.on("teacher:nextQuestion", ({ code }, callback) => {
            try {
                const result = sessionManager.nextQuestion(code);
                callback?.(result.ok ? { ok: true, finished: result.finished } : result);
                if (result.ok) {
                    emitAllState(code);
                }
            } catch (error) {
                console.error("teacher:nextQuestion error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to move to next question",
                });
            }
        });

        socket.on("teacher:resetGame", ({ code }, callback) => {
            try {
                const result = sessionManager.resetGame(code);
                callback?.(result.ok ? { ok: true } : result);
                if (result.ok) {
                    emitAllState(code);
                }
            } catch (error) {
                console.error("teacher:resetGame error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to reset game",
                });
            }
        });

        socket.on("session:getState", ({ code }, callback) => {
            try {
                const result = sessionManager.getTeacherState(code);
                callback?.(result);
            } catch (error) {
                console.error("session:getState error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to get session state",
                });
            }
        });

        socket.on("disconnect", () => {
            try {
                const { role, code, playerId } = socket.data || {};
                sessionManager.markDisconnected({ role, code, playerId });
                if (code) {
                    emitAllState(code);
                }
                console.log(`Socket disconnected: ${socket.id}`);
            } catch (error) {
                console.error("disconnect error:", error);
            }
        });
    });

    const cleanupTimer = setInterval(() => {
        const removedCount = sessionManager.cleanupExpiredSessions();
        if (removedCount > 0) {
            console.log(`Cleaned up ${removedCount} expired session(s)`);
        }
    }, config.cleanupIntervalMs);

    cleanupTimer.unref?.();

    return {
        app,
        server,
        io,
        config,
        sessionManager,
        close: () => {
            clearInterval(cleanupTimer);
            return new Promise((resolve, reject) => {
                io.close((ioError) => {
                    server.close((serverError) => {
                        const closeError = ioError || serverError;
                        if (closeError && closeError.code !== "ERR_SERVER_NOT_RUNNING") {
                            reject(closeError);
                            return;
                        }

                        resolve();
                    });
                });
            });
        },
    };
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && entryPath === process.argv[1]) {
    const runtime = createAppServer();
    runtime.server.listen(runtime.config.port, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${runtime.config.port}`);
    });
}
