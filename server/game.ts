import { nanoid } from "nanoid";

import type {
    AckResponse,
    ErrorResponse,
    GameStatus,
    Player,
    PlayerState,
    PersistedPlayer,
    PersistedSession,
    PublicQuestion,
    Question,
    ScreenState,
    TeacherQuestion,
    TeacherState,
} from "../shared/types.js";
import { questions as defaultQuestions } from "./questions.js";

export const GAME_STATUS = {
    LOBBY: "lobby",
    QUESTION: "question",
    RESULT: "result",
    FINISHED: "finished",
} as const satisfies Record<string, GameStatus>;

type InternalPlayer = PersistedPlayer & {
    socketId: string | null;
};

export type Session = {
    code: string;
    teacherToken: string;
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
    status: GameStatus;
    currentQuestionIndex: number;
    questions: Question[];
    players: Record<string, InternalPlayer>;
};

type SessionSnapshot = {
    teacher: TeacherState;
    screen: ScreenState;
    players: Record<string, PlayerState>;
};

type SessionManagerOptions = {
    initialQuestions?: Question[];
    initialSessions?: PersistedSession[];
    maxPlayersPerSession?: number;
    sessionTtlMs?: number;
    now?: () => number;
    createCode?: () => string;
    createPlayerId?: () => string;
    createTeacherToken?: () => string;
    createPlayerToken?: () => string;
};

type AuthTeacherResult = AckResponse<{ session: Session }>;
type AuthPlayerResult = AckResponse<{ session: Session; player: InternalPlayer }>;

const SESSION_CODE_RETRY_LIMIT = 20;
const PLAYER_ID_RETRY_LIMIT = 20;

export function createError(code: string, error: string): ErrorResponse {
    return { ok: false, code, error };
}

const UNAUTHORIZED_ERROR = () => createError("UNAUTHORIZED", "Authorization failed");

function createOk<T extends object = object>(payload = {} as T): AckResponse<T> {
    return { ok: true, ...payload };
}

function randomColor(): string {
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
    return colors[Math.floor(Math.random() * colors.length)] ?? colors[0]!;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function safePlayerName(name: unknown): string {
    if (typeof name !== "string") return "Ойыншы";
    const trimmed = name.trim().slice(0, 24);
    return trimmed || "Ойыншы";
}

function calculatePoints({ isCorrect }: { isCorrect: boolean }): number {
    return isCorrect ? 10 : 0;
}

function calculateProgressDelta({ isCorrect }: { isCorrect: boolean }): number {
    return isCorrect ? 10 : 0;
}

function getPublicQuestion(question: Question | null | undefined): PublicQuestion | null {
    if (!question) return null;

    const { correctIndex: _, ...publicQuestion } = question;
    return {
        ...publicQuestion,
        options: question.options.map((option) => ({ ...option })),
        sourceMeta: question.sourceMeta ? { ...question.sourceMeta } : null,
    };
}

function getTeacherQuestion(question: Question | null | undefined): TeacherQuestion | null {
    if (!question) return null;

    return {
        ...getPublicQuestion(question)!,
        correctIndex: question.correctIndex,
    };
}

function normalizePlayers(playersMap: Record<string, InternalPlayer>): InternalPlayer[] {
    return [...Object.values(playersMap)].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.joinedAt - b.joinedAt;
    });
}

function countAnswered(playersMap: Record<string, InternalPlayer>): number {
    return Object.values(playersMap).filter((player) => player.answeredCurrent).length;
}

function getTeacherControls(status: GameStatus) {
    return {
        canStart: status === GAME_STATUS.LOBBY,
        canShowResults: status === GAME_STATUS.QUESTION,
        canGoNext: status === GAME_STATUS.RESULT,
        canReset: true,
    };
}

function serializePlayer(player: InternalPlayer | null | undefined): Player | null {
    if (!player) return null;

    return {
        id: player.id,
        name: player.name,
        score: player.score,
        progress: player.progress,
        color: player.color,
        connected: player.connected,
        answeredCurrent: player.answeredCurrent,
        selectedOption: player.selectedOption,
        lastAnswerCorrect: player.lastAnswerCorrect,
        joinedAt: player.joinedAt,
    };
}

function cloneQuestion(question: Question): Question {
    return {
        ...question,
        options: question.options.map((option) => ({ ...option })),
        sourceMeta: question.sourceMeta ? { ...question.sourceMeta } : null,
    };
}

export function createSessionManager(options: SessionManagerOptions = {}) {
    const {
        initialQuestions = defaultQuestions,
        initialSessions = [],
        maxPlayersPerSession = 50,
        sessionTtlMs = 1000 * 60 * 60 * 4,
        now = () => Date.now(),
        createCode = () => nanoid(6).toUpperCase(),
        createPlayerId = () => nanoid(8),
        createTeacherToken = () => nanoid(24),
        createPlayerToken = () => nanoid(24),
    } = options;

    const sessions: Record<string, Session> = Object.create(null);

    for (const session of initialSessions) {
        sessions[session.code] = {
            ...session,
            questions: session.questions.map(cloneQuestion),
            players: Object.fromEntries(
                Object.entries(session.players).map(([playerId, player]) => [
                    playerId,
                    {
                        ...player,
                        socketId: null,
                        connected: false,
                    },
                ])
            ),
        };
    }

    function cloneQuestions(): Question[] {
        return initialQuestions.map(cloneQuestion);
    }

    function toPersistedSession(session: Session): PersistedSession {
        return {
            code: session.code,
            teacherToken: session.teacherToken,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            expiresAt: session.expiresAt,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            questions: session.questions.map(cloneQuestion),
            players: Object.values(session.players).reduce<Record<string, PersistedPlayer>>((acc, player) => {
                acc[player.id] = {
                    id: player.id,
                    playerToken: player.playerToken,
                    name: player.name,
                    score: player.score,
                    progress: player.progress,
                    color: player.color,
                    connected: false,
                    answeredCurrent: player.answeredCurrent,
                    selectedOption: player.selectedOption,
                    lastAnswerCorrect: player.lastAnswerCorrect,
                    joinedAt: player.joinedAt,
                };
                return acc;
            }, Object.create(null) as Record<string, PersistedPlayer>),
        };
    }

    function getSession(code: string): Session | null {
        const session = sessions[code] ?? null;
        if (!session) return null;

        if (session.expiresAt <= now()) {
            delete sessions[code];
            return null;
        }

        return session;
    }

    function touchSession(session: Session): void {
        session.updatedAt = now();
        session.expiresAt = session.updatedAt + sessionTtlMs;
    }

    function resetPlayersForNewQuestion(session: Session): void {
        for (const player of Object.values(session.players)) {
            player.answeredCurrent = false;
            player.selectedOption = null;
            player.lastAnswerCorrect = null;
        }
    }

    function isSessionFinished(session: Session): boolean {
        return session.currentQuestionIndex >= session.questions.length;
    }

    function buildStateForTeacher(session: Session): TeacherState {
        const currentQuestion = session.questions[session.currentQuestionIndex] ?? null;
        const players = normalizePlayers(session.players).map((player) => serializePlayer(player)!);

        const optionStats = currentQuestion
            ? currentQuestion.options.map((option, index) => {
                let count = 0;
                for (const player of players) {
                    if (player.selectedOption === index) count += 1;
                }

                return {
                    index,
                    option: { ...option },
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

    function buildStateForPlayer(session: Session, playerId: string): PlayerState {
        const currentQuestion = session.questions[session.currentQuestionIndex] ?? null;
        const player = session.players[playerId] ?? null;

        return {
            role: "player",
            code: session.code,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            totalQuestions: session.questions.length,
            currentQuestion: session.status === GAME_STATUS.QUESTION ? getPublicQuestion(currentQuestion) : null,
            player: serializePlayer(player),
        };
    }

    function buildStateForScreen(session: Session): ScreenState {
        const currentQuestion = session.questions[session.currentQuestionIndex] ?? null;

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
            players: normalizePlayers(session.players).map((player) => serializePlayer(player)!),
            answeredCount: countAnswered(session.players),
            totalPlayers: Object.keys(session.players).length,
        };
    }

    function createSession(): AckResponse<{ code: string; teacherToken: string; session: Session }> {
        let code = "";
        for (let attempt = 0; attempt < SESSION_CODE_RETRY_LIMIT; attempt += 1) {
            const candidate = createCode();
            if (!sessions[candidate]) {
                code = candidate;
                break;
            }
        }

        if (!code) {
            return createError("SESSION_CODE_COLLISION", "Failed to allocate a unique session code");
        }

        const timestamp = now();
        const session: Session = {
            code,
            teacherToken: createTeacherToken(),
            createdAt: timestamp,
            updatedAt: timestamp,
            expiresAt: timestamp + sessionTtlMs,
            status: GAME_STATUS.LOBBY,
            currentQuestionIndex: 0,
            questions: cloneQuestions(),
            players: Object.create(null) as Record<string, InternalPlayer>,
        };

        sessions[code] = session;

        return createOk({ code, teacherToken: session.teacherToken, session });
    }

    function authorizeTeacher(code: string, teacherToken: string): AuthTeacherResult {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        if (session.teacherToken !== teacherToken) {
            return UNAUTHORIZED_ERROR();
        }

        return createOk({ session });
    }

    function attachTeacher({ code, teacherToken }: { code: string; teacherToken: string }): AuthTeacherResult {
        const authResult = authorizeTeacher(code, teacherToken);
        if (!authResult.ok) {
            return authResult;
        }

        touchSession(authResult.session);
        return authResult;
    }

    function attachScreen(code: string): AuthTeacherResult {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        touchSession(session);
        return createOk({ session });
    }

    function joinPlayer({
        code,
        name,
        socketId,
    }: {
        code: string;
        name: unknown;
        socketId: string;
    }): AckResponse<{ playerId: string; playerToken: string; session: Session }> {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        const totalPlayers = Object.keys(session.players).length;
        if (totalPlayers >= maxPlayersPerSession) {
            return createError("SESSION_FULL", "Session is full");
        }

        let playerId = "";
        for (let attempt = 0; attempt < PLAYER_ID_RETRY_LIMIT; attempt += 1) {
            const candidate = createPlayerId();
            if (!session.players[candidate]) {
                playerId = candidate;
                break;
            }
        }

        if (!playerId) {
            return createError("PLAYER_ID_COLLISION", "Failed to allocate a unique player id");
        }

        const playerToken = createPlayerToken();
        session.players[playerId] = {
            id: playerId,
            playerToken,
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
        return createOk({ playerId, playerToken, session });
    }

    function authorizePlayer(code: string, playerId: string, playerToken: string): AuthPlayerResult {
        const session = getSession(code);
        if (!session) {
            return createError("SESSION_NOT_FOUND", "Session not found");
        }

        const player = session.players[playerId];
        if (!player) {
            return createError("PLAYER_NOT_FOUND", "Player not found");
        }

        if (player.playerToken !== playerToken) {
            return UNAUTHORIZED_ERROR();
        }

        return createOk({ session, player });
    }

    function rejoinPlayer({
        code,
        playerId,
        playerToken,
        socketId,
    }: {
        code: string;
        playerId: string;
        playerToken: string;
        socketId: string;
    }): AckResponse<{ playerId: string; session: Session; playerState: PlayerState }> {
        const authResult = authorizePlayer(code, playerId, playerToken);
        if (!authResult.ok) {
            return authResult;
        }

        const { session, player } = authResult;
        player.socketId = socketId;
        player.connected = true;
        touchSession(session);

        return createOk({ playerId, session, playerState: buildStateForPlayer(session, playerId) });
    }

    function startQuestion({
        code,
        teacherToken,
    }: {
        code: string;
        teacherToken: string;
    }): AckResponse<{ session: Session }> {
        const authResult = authorizeTeacher(code, teacherToken);
        if (!authResult.ok) {
            return authResult;
        }

        const { session } = authResult;

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

    function submitAnswer({
        code,
        playerId,
        playerToken,
        optionIndex,
    }: {
        code: string;
        playerId: string;
        playerToken: string;
        optionIndex: unknown;
    }): AckResponse<{
        isCorrect: boolean;
        points: number;
        totalScore: number;
        progress: number;
        session: Session;
    }> {
        const authResult = authorizePlayer(code, playerId, playerToken);
        if (!authResult.ok) {
            return authResult;
        }

        const { session, player } = authResult;

        if (session.status !== GAME_STATUS.QUESTION) {
            return createError("QUESTION_NOT_ACTIVE", "Question is not active");
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
            !Number.isInteger(normalizedOptionIndex) ||
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

    function showResults({
        code,
        teacherToken,
    }: {
        code: string;
        teacherToken: string;
    }): AckResponse<{ session: Session }> {
        const authResult = authorizeTeacher(code, teacherToken);
        if (!authResult.ok) {
            return authResult;
        }

        const { session } = authResult;

        if (session.status !== GAME_STATUS.QUESTION) {
            return createError("INVALID_TRANSITION", "Results can only be shown for an active question");
        }

        session.status = GAME_STATUS.RESULT;
        touchSession(session);
        return createOk({ session });
    }

    function nextQuestion({
        code,
        teacherToken,
    }: {
        code: string;
        teacherToken: string;
    }): AckResponse<{ finished: boolean; session: Session }> {
        const authResult = authorizeTeacher(code, teacherToken);
        if (!authResult.ok) {
            return authResult;
        }

        const { session } = authResult;

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

    function resetGame({
        code,
        teacherToken,
    }: {
        code: string;
        teacherToken: string;
    }): AckResponse<{ session: Session }> {
        const authResult = authorizeTeacher(code, teacherToken);
        if (!authResult.ok) {
            return authResult;
        }

        const { session } = authResult;

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

    function getTeacherState({
        code,
        teacherToken,
    }: {
        code: string;
        teacherToken: string;
    }): AckResponse<{ state: TeacherState; session: Session }> {
        const authResult = authorizeTeacher(code, teacherToken);
        if (!authResult.ok) {
            return authResult;
        }

        return createOk({ state: buildStateForTeacher(authResult.session), session: authResult.session });
    }

    function markDisconnected({
        code,
        role,
        playerId,
    }: {
        code?: string | undefined;
        role?: string | undefined;
        playerId?: string | undefined;
    }): void {
        if (!code) return;

        const session = getSession(code);
        if (!session) return;

        if (role === "player" && playerId && session.players[playerId]) {
            session.players[playerId].connected = false;
            session.players[playerId].socketId = null;
            touchSession(session);
        }
    }

    function cleanupExpiredSessions(): number {
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

    function snapshot(code: string): SessionSnapshot | null {
        const session = getSession(code);
        if (!session) return null;

        return {
            teacher: buildStateForTeacher(session),
            screen: buildStateForScreen(session),
            players: Object.values(session.players).reduce<Record<string, PlayerState>>((acc, player) => {
                acc[player.id] = buildStateForPlayer(session, player.id);
                return acc;
            }, Object.create(null) as Record<string, PlayerState>),
        };
    }

    return {
        GAME_STATUS,
        sessions,
        getSession,
        createSession,
        attachTeacher,
        attachScreen,
        authorizeTeacher,
        authorizePlayer,
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
        toPersistedSession,
    };
}

export type SessionManager = ReturnType<typeof createSessionManager>;
