import cors from "cors";
import express from "express";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { Server } from "socket.io";

import type { ClientToServerEvents, ErrorResponse, ServerToClientEvents } from "../shared/types.js";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import type { SessionManager } from "./game.js";
import { createSessionManager } from "./game.js";

type ServerSideEvents = Record<string, never>;
type SocketData = {
    role?: "teacher" | "player" | "screen";
    code?: string;
    playerId?: string;
};

type CorsOriginMatcher =
    | "*"
    | ((origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void);

type CreateAppServerOptions = {
    config?: AppConfig;
    sessionManager?: SessionManager;
};

type RateLimitBucket = {
    count: number;
    windowStartedAt: number;
};

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMITS = {
    teacherCreateSession: 5,
    teacherAction: 30,
    playerJoin: 12,
    playerAction: 40,
    screenJoin: 20,
} as const;

function createCorsOriginMatcher(origins: AppConfig["clientOrigins"]): CorsOriginMatcher {
    if (origins === "*") return "*";

    return function corsOrigin(origin, callback) {
        if (!origin || origins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("Origin is not allowed by CORS"));
    };
}

function rateLimitedError(): ErrorResponse {
    return {
        ok: false,
        code: "RATE_LIMITED",
        error: "Too many requests. Please try again shortly.",
    };
}

export function createAppServer(options: CreateAppServerOptions = {}) {
    const config = options.config ?? loadConfig();
    const app = express();
    const server = http.createServer(app);
    const sessionManager = options.sessionManager ?? createSessionManager({
        maxPlayersPerSession: config.maxPlayersPerSession,
        sessionTtlMs: config.sessionTtlMs,
    });

    app.use(cors({
        origin: createCorsOriginMatcher(config.clientOrigins),
    }));
    app.use(express.json());

    const io = new Server<ClientToServerEvents, ServerToClientEvents, ServerSideEvents, SocketData>(server, {
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

    function emitAllState(code: string): void {
        const session = sessionManager.getSession(code);
        if (!session) return;

        const snapshot = sessionManager.snapshot(code);
        if (!snapshot) return;

        io.to(`teacher:${code}`).emit("session:state", snapshot.teacher);
        io.to(`screen:${code}`).emit("session:state", snapshot.screen);

        for (const player of Object.values(session.players)) {
            if (!player.socketId) continue;
            io.to(player.socketId).emit("session:state", snapshot.players[player.id]!);
        }
    }

    function validateTeacherAccessPin(accessPin: unknown) {
        if (typeof accessPin === "string" && config.teacherAccessPin && accessPin === config.teacherAccessPin) {
            return { ok: true } as const;
        }

        return {
            ok: false,
            code: "TEACHER_ACCESS_DENIED",
            error: "Teacher access denied",
        } as const;
    }

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        const rateLimitBuckets = new Map<string, RateLimitBucket>();

        function isRateLimited(key: string, limit: number): boolean {
            const currentTime = Date.now();
            const bucket = rateLimitBuckets.get(key);

            if (!bucket || currentTime - bucket.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
                rateLimitBuckets.set(key, { count: 1, windowStartedAt: currentTime });
                return false;
            }

            bucket.count += 1;
            return bucket.count > limit;
        }

        socket.on("teacher:createSession", (payload, callback) => {
            try {
                if (isRateLimited("teacher:createSession", RATE_LIMITS.teacherCreateSession)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const accessResult = validateTeacherAccessPin(payload?.accessPin);
                if (!accessResult.ok) {
                    callback?.(accessResult);
                    return;
                }

                const result = sessionManager.createSession();
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                const attachResult = sessionManager.attachTeacher({
                    code: result.code,
                    teacherToken: result.teacherToken,
                });
                if (!attachResult.ok) {
                    callback?.(attachResult);
                    return;
                }

                socket.data.role = "teacher";
                socket.data.code = result.code;
                socket.join(`teacher:${result.code}`);
                callback?.({ ok: true, code: result.code, teacherToken: result.teacherToken });
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

        socket.on("teacher:joinSession", ({ code, teacherToken }, callback) => {
            try {
                if (isRateLimited("teacher:joinSession", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const result = sessionManager.attachTeacher({ code, teacherToken });
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                socket.data.role = "teacher";
                socket.data.code = code;
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
                if (isRateLimited("screen:join", RATE_LIMITS.screenJoin)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const result = sessionManager.attachScreen(code);
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                socket.data.role = "screen";
                socket.data.code = code;
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
                if (isRateLimited("player:join", RATE_LIMITS.playerJoin)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const result = sessionManager.joinPlayer({ code, name, socketId: socket.id });
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                socket.data.role = "player";
                socket.data.code = code;
                socket.data.playerId = result.playerId;
                callback?.({ ok: true, playerId: result.playerId, playerToken: result.playerToken });
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

        socket.on("player:rejoin", ({ code, playerId, playerToken }, callback) => {
            try {
                if (isRateLimited("player:rejoin", RATE_LIMITS.playerJoin)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const result = sessionManager.rejoinPlayer({ code, playerId, playerToken, socketId: socket.id });
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                socket.data.role = "player";
                socket.data.code = code;
                socket.data.playerId = playerId;
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

        socket.on("teacher:startQuestion", ({ code, teacherToken }, callback) => {
            try {
                if (isRateLimited("teacher:startQuestion", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const result = sessionManager.startQuestion({ code, teacherToken });
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

        socket.on("player:submitAnswer", ({ code, playerId, playerToken, optionIndex }, callback) => {
            try {
                if (isRateLimited("player:submitAnswer", RATE_LIMITS.playerAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const result = sessionManager.submitAnswer({ code, playerId, playerToken, optionIndex });
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

        socket.on("teacher:showResults", ({ code, teacherToken }, callback) => {
            try {
                if (isRateLimited("teacher:showResults", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const result = sessionManager.showResults({ code, teacherToken });
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

        socket.on("teacher:nextQuestion", ({ code, teacherToken }, callback) => {
            try {
                if (isRateLimited("teacher:nextQuestion", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const result = sessionManager.nextQuestion({ code, teacherToken });
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

        socket.on("teacher:resetGame", ({ code, teacherToken }, callback) => {
            try {
                if (isRateLimited("teacher:resetGame", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const result = sessionManager.resetGame({ code, teacherToken });
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

        socket.on("disconnect", () => {
            try {
                const { role, code, playerId } = socket.data;
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
            return new Promise<void>((resolve, reject) => {
                io.close((ioError) => {
                    server.close((serverError?: Error) => {
                        const closeError = ioError ?? serverError;
                        if (closeError && (closeError as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
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
        if (runtime.config.teacherAccessPinIsGenerated) {
            console.log(`Teacher access PIN: ${runtime.config.teacherAccessPin}`);
        }
    });
}
