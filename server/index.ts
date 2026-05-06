import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import fs from "node:fs";
import { nanoid } from "nanoid";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Server } from "socket.io";

import type { ClientToServerEvents, ErrorResponse, QuestionSet, QuestionSetDraft, ServerToClientEvents } from "../shared/types.js";
import { buildClassroomInfo, printClassroomInfo } from "./classroom.js";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { createClassroomDatabase } from "./db/database.js";
import type { ClassroomRepository } from "./db/repository.js";
import { ClassroomRepository as Repository } from "./db/repository.js";
import type { SessionManager } from "./game.js";
import { createSessionManager } from "./game.js";
import { normalizeTextQuestionDraft } from "./questions.js";
import {
    addSessionQuestionPayloadSchema,
    formatPayloadError,
    playerJoinPayloadSchema,
    playerRejoinPayloadSchema,
    questionSetCreatePayloadSchema,
    questionSetDeletePayloadSchema,
    questionSetUpdatePayloadSchema,
    screenJoinPayloadSchema,
    submitAnswerPayloadSchema,
    teacherAccessPayloadSchema,
    teacherCreateSessionPayloadSchema,
    teacherSessionPayloadSchema,
} from "./validation.js";

type ServerSideEvents = Record<string, never>;
type SocketData = {
    role?: "teacher" | "player" | "screen";
    code?: string;
    playerId?: string;
};

type CreateAppServerOptions = {
    config?: AppConfig;
    sessionManager?: SessionManager;
    repository?: ClassroomRepository | null;
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

function rateLimitedError(): ErrorResponse {
    return {
        ok: false,
        code: "RATE_LIMITED",
        error: "Too many requests. Please try again shortly.",
    };
}

function storageUnavailableError(): ErrorResponse {
    return {
        ok: false,
        code: "STORAGE_UNAVAILABLE",
        error: "Question library storage is unavailable",
    };
}

function createQuestionSetFromDraft(
    draft: QuestionSetDraft,
    options: { id?: string; createdAt?: number } = {}
): QuestionSet {
    const timestamp = Date.now();

    return {
        id: options.id ?? draft.id ?? nanoid(12),
        title: draft.title,
        questions: draft.questions.map((question, index) =>
            normalizeTextQuestionDraft(question, index, { createId: () => nanoid(10) })
        ),
        createdAt: options.createdAt ?? timestamp,
        updatedAt: timestamp,
    };
}

function persistSession(sessionManager: SessionManager, repository: ClassroomRepository | null, code: string): void {
    const session = sessionManager.getSession(code);
    if (!session || !repository) return;
    repository.saveSession(sessionManager.toPersistedSession(session));
}

function clientIndexPath(staticDir: string | null): string | null {
    if (!staticDir) return null;
    const indexPath = path.join(staticDir, "index.html");
    return fs.existsSync(indexPath) ? indexPath : null;
}

export async function createAppServer(options: CreateAppServerOptions = {}) {
    const config = options.config ?? loadConfig();
    const ownedDatabase = options.repository === undefined
        ? createClassroomDatabase(config.databasePath)
        : null;
    const repository = options.repository === undefined
        ? new Repository(ownedDatabase!)
        : options.repository;
    const persistedSessions = repository?.listSessions() ?? [];
    const sessionManager = options.sessionManager ?? createSessionManager({
        initialSessions: persistedSessions,
        maxPlayersPerSession: config.maxPlayersPerSession,
        sessionTtlMs: config.sessionTtlMs,
    });
    const app = Fastify({ logger: false });

    await app.register(fastifyCors, {
        origin: config.clientOrigins === "*" ? true : config.clientOrigins,
    });

    const indexPath = clientIndexPath(config.staticDir);
    if (config.staticDir && indexPath) {
        await app.register(fastifyStatic, {
            root: config.staticDir,
            prefix: "/",
        });
    }

    const io = new Server<ClientToServerEvents, ServerToClientEvents, ServerSideEvents, SocketData>(app.server, {
        cors: {
            origin: config.clientOrigins === "*" ? "*" : config.clientOrigins,
            methods: ["GET", "POST"],
        },
    });

    app.get("/health", async () => ({
        ok: true,
        status: "healthy",
        activeSessions: Object.keys(sessionManager.sessions).length,
        uptimeSeconds: Math.round(process.uptime()),
    }));

    app.get("/ready", async () => ({
        ok: true,
        status: "ready",
        activeSessions: Object.keys(sessionManager.sessions).length,
    }));

    app.get("/classroom-info", async () => buildClassroomInfo({
        port: config.port,
        teacherAccessPin: config.teacherAccessPin,
    }));

    app.get("/", async (_request, reply) => {
        if (indexPath) return reply.sendFile("index.html");
        return {
            ok: true,
            message: "Kahoot horses server is running",
        };
    });

    if (indexPath) {
        app.setNotFoundHandler(async (request, reply) => {
            if (request.method === "GET" && !request.url.startsWith("/socket.io")) {
                return reply.sendFile("index.html");
            }

            return reply.code(404).send({ ok: false, error: "Not found" });
        });
    }

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

        socket.on("questionSet:list", (rawPayload, callback) => {
            try {
                if (isRateLimited("questionSet:list", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = teacherAccessPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const accessResult = validateTeacherAccessPin(payload.data.accessPin);
                if (!accessResult.ok) {
                    callback?.(accessResult);
                    return;
                }

                callback?.({ ok: true, questionSets: repository?.listQuestionSets() ?? [] });
            } catch (error) {
                console.error("questionSet:list error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to list question sets",
                });
            }
        });

        socket.on("questionSet:create", (rawPayload, callback) => {
            try {
                if (isRateLimited("questionSet:create", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = questionSetCreatePayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const accessResult = validateTeacherAccessPin(payload.data.accessPin);
                if (!accessResult.ok) {
                    callback?.(accessResult);
                    return;
                }

                if (!repository) {
                    callback?.(storageUnavailableError());
                    return;
                }

                const questionSet = createQuestionSetFromDraft(payload.data.questionSet);
                repository.saveQuestionSet(questionSet);
                callback?.({ ok: true, questionSet });
            } catch (error) {
                console.error("questionSet:create error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to create question set",
                });
            }
        });

        socket.on("questionSet:get", (rawPayload, callback) => {
            try {
                if (isRateLimited("questionSet:get", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = questionSetDeletePayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const accessResult = validateTeacherAccessPin(payload.data.accessPin);
                if (!accessResult.ok) {
                    callback?.(accessResult);
                    return;
                }

                const questionSet = repository?.getQuestionSet(payload.data.questionSetId) ?? null;
                if (!questionSet) {
                    callback?.({
                        ok: false,
                        code: "QUESTION_SET_NOT_FOUND",
                        error: "Question set not found",
                    });
                    return;
                }

                callback?.({ ok: true, questionSet });
            } catch (error) {
                console.error("questionSet:get error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to load question set",
                });
            }
        });

        socket.on("questionSet:update", (rawPayload, callback) => {
            try {
                if (isRateLimited("questionSet:update", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = questionSetUpdatePayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const accessResult = validateTeacherAccessPin(payload.data.accessPin);
                if (!accessResult.ok) {
                    callback?.(accessResult);
                    return;
                }

                if (!repository) {
                    callback?.(storageUnavailableError());
                    return;
                }

                const existing = repository.getQuestionSet(payload.data.questionSetId);
                if (!existing) {
                    callback?.({
                        ok: false,
                        code: "QUESTION_SET_NOT_FOUND",
                        error: "Question set not found",
                    });
                    return;
                }

                const questionSet = createQuestionSetFromDraft(payload.data.questionSet, {
                    id: existing.id,
                    createdAt: existing.createdAt,
                });
                repository.saveQuestionSet(questionSet);
                callback?.({ ok: true, questionSet });
            } catch (error) {
                console.error("questionSet:update error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to update question set",
                });
            }
        });

        socket.on("questionSet:delete", (rawPayload, callback) => {
            try {
                if (isRateLimited("questionSet:delete", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = questionSetDeletePayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const accessResult = validateTeacherAccessPin(payload.data.accessPin);
                if (!accessResult.ok) {
                    callback?.(accessResult);
                    return;
                }

                if (!repository) {
                    callback?.(storageUnavailableError());
                    return;
                }

                repository.deleteQuestionSet(payload.data.questionSetId);
                callback?.({ ok: true });
            } catch (error) {
                console.error("questionSet:delete error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to delete question set",
                });
            }
        });

        socket.on("teacher:createSession", (rawPayload, callback) => {
            try {
                if (isRateLimited("teacher:createSession", RATE_LIMITS.teacherCreateSession)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = teacherCreateSessionPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const accessResult = validateTeacherAccessPin(payload.data.accessPin);
                if (!accessResult.ok) {
                    callback?.(accessResult);
                    return;
                }

                const questionSet = repository?.getQuestionSet(payload.data.questionSetId) ?? null;
                if (!questionSet) {
                    callback?.({
                        ok: false,
                        code: "QUESTION_SET_NOT_FOUND",
                        error: "Question set not found",
                    });
                    return;
                }

                const result = sessionManager.createSession({ questions: questionSet.questions });
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
                persistSession(sessionManager, repository, result.code);
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

        socket.on("teacher:joinSession", (rawPayload, callback) => {
            try {
                if (isRateLimited("teacher:joinSession", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = teacherSessionPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const { code, teacherToken } = payload.data;
                const result = sessionManager.attachTeacher({ code, teacherToken });
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                socket.data.role = "teacher";
                socket.data.code = code;
                socket.join(`teacher:${code}`);
                persistSession(sessionManager, repository, code);
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

        socket.on("screen:join", (rawPayload, callback) => {
            try {
                if (isRateLimited("screen:join", RATE_LIMITS.screenJoin)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = screenJoinPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const { code } = payload.data;
                const result = sessionManager.attachScreen(code);
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                socket.data.role = "screen";
                socket.data.code = code;
                socket.join(`screen:${code}`);
                persistSession(sessionManager, repository, code);
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

        socket.on("player:join", (rawPayload, callback) => {
            try {
                if (isRateLimited("player:join", RATE_LIMITS.playerJoin)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = playerJoinPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const { code, name } = payload.data;
                const result = sessionManager.joinPlayer({ code, name, socketId: socket.id });
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                socket.data.role = "player";
                socket.data.code = code;
                socket.data.playerId = result.playerId;
                persistSession(sessionManager, repository, code);
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

        socket.on("player:rejoin", (rawPayload, callback) => {
            try {
                if (isRateLimited("player:rejoin", RATE_LIMITS.playerJoin)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = playerRejoinPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const { code, playerId, playerToken } = payload.data;
                const result = sessionManager.rejoinPlayer({ code, playerId, playerToken, socketId: socket.id });
                if (!result.ok) {
                    callback?.(result);
                    return;
                }

                socket.data.role = "player";
                socket.data.code = code;
                socket.data.playerId = playerId;
                persistSession(sessionManager, repository, code);
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

        socket.on("teacher:startQuestion", (rawPayload, callback) => {
            try {
                if (isRateLimited("teacher:startQuestion", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = teacherSessionPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const { code, teacherToken } = payload.data;
                const result = sessionManager.startQuestion({ code, teacherToken });
                callback?.(result.ok ? { ok: true } : result);
                if (result.ok || result.code === "GAME_ALREADY_FINISHED") {
                    persistSession(sessionManager, repository, code);
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

        socket.on("player:submitAnswer", (rawPayload, callback) => {
            try {
                if (isRateLimited("player:submitAnswer", RATE_LIMITS.playerAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = submitAnswerPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const { code, playerId, playerToken, optionIndex } = payload.data;
                const result = sessionManager.submitAnswer({ code, playerId, playerToken, optionIndex });
                callback?.(result);
                if (result.ok) {
                    const session = sessionManager.getSession(code);
                    const question = session?.questions[session.currentQuestionIndex];
                    if (session && question && repository) {
                        repository.recordAnswer({
                            sessionCode: code,
                            playerId,
                            questionId: question.id,
                            questionIndex: session.currentQuestionIndex,
                            optionIndex,
                            isCorrect: result.isCorrect,
                            points: result.points,
                        });
                    }
                    persistSession(sessionManager, repository, code);
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

        socket.on("teacher:showResults", (rawPayload, callback) => {
            try {
                if (isRateLimited("teacher:showResults", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = teacherSessionPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const { code, teacherToken } = payload.data;
                const result = sessionManager.showResults({ code, teacherToken });
                callback?.(result.ok ? { ok: true } : result);
                if (result.ok) {
                    persistSession(sessionManager, repository, code);
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

        socket.on("teacher:nextQuestion", (rawPayload, callback) => {
            try {
                if (isRateLimited("teacher:nextQuestion", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = teacherSessionPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const { code, teacherToken } = payload.data;
                const result = sessionManager.nextQuestion({ code, teacherToken });
                callback?.(result.ok ? { ok: true, finished: result.finished } : result);
                if (result.ok) {
                    persistSession(sessionManager, repository, code);
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

        socket.on("teacher:resetGame", (rawPayload, callback) => {
            try {
                if (isRateLimited("teacher:resetGame", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = teacherSessionPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const { code, teacherToken } = payload.data;
                const result = sessionManager.resetGame({ code, teacherToken });
                callback?.(result.ok ? { ok: true } : result);
                if (result.ok) {
                    persistSession(sessionManager, repository, code);
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

        socket.on("session:addQuestion", (rawPayload, callback) => {
            try {
                if (isRateLimited("session:addQuestion", RATE_LIMITS.teacherAction)) {
                    callback?.(rateLimitedError());
                    return;
                }

                const payload = addSessionQuestionPayloadSchema.safeParse(rawPayload);
                if (!payload.success) {
                    callback?.(formatPayloadError());
                    return;
                }

                const question = normalizeTextQuestionDraft(payload.data.question, 0, {
                    createId: () => nanoid(10),
                });
                const result = sessionManager.addQuestion({
                    code: payload.data.code,
                    teacherToken: payload.data.teacherToken,
                    question,
                });
                callback?.(result.ok ? { ok: true } : result);
                if (result.ok) {
                    persistSession(sessionManager, repository, payload.data.code);
                    emitAllState(payload.data.code);
                }
            } catch (error) {
                console.error("session:addQuestion error:", error);
                callback?.({
                    ok: false,
                    code: "INTERNAL_ERROR",
                    error: "Failed to add question",
                });
            }
        });

        socket.on("disconnect", () => {
            try {
                const { role, code, playerId } = socket.data;
                sessionManager.markDisconnected({ role, code, playerId });
                if (code) {
                    persistSession(sessionManager, repository, code);
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
        server: app.server,
        io,
        config,
        sessionManager,
        repository,
        listen: (host = "0.0.0.0") => app.listen({ port: config.port, host }),
        close: async () => {
            clearInterval(cleanupTimer);
            await io.close();
            await app.close();
            ownedDatabase?.close();
        },
    };
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && entryPath === process.argv[1]) {
    const runtime = await createAppServer();
    await runtime.listen();
    printClassroomInfo(buildClassroomInfo({
        port: runtime.config.port,
        teacherAccessPin: runtime.config.teacherAccessPin,
    }));
}
