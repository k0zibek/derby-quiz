const TEACHER_STORAGE_KEY = "horse-quiz-teacher";

type TeacherSessionRecord = {
    code: string;
    teacherToken: string;
};

type PlayerSessionRecord = {
    playerId: string;
    playerToken: string;
};

function hasStorage(): boolean {
    return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonItem(key: string): unknown {
    if (!hasStorage()) return null;

    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return null;

    try {
        return JSON.parse(rawValue) as unknown;
    } catch {
        window.localStorage.removeItem(key);
        return null;
    }
}

function writeJsonItem(key: string, value: object): void {
    if (!hasStorage()) return;
    window.localStorage.setItem(key, JSON.stringify(value));
}

function removeItem(key: string): void {
    if (!hasStorage()) return;
    window.localStorage.removeItem(key);
}

function playerStorageKey(code: string): string {
    return `horse-quiz-player:${code}`;
}

export function loadTeacherSession(): TeacherSessionRecord | null {
    const parsed = readJsonItem(TEACHER_STORAGE_KEY);
    if (
        isRecord(parsed) &&
        typeof parsed.code === "string" &&
        typeof parsed.teacherToken === "string"
    ) {
        return {
            code: parsed.code,
            teacherToken: parsed.teacherToken,
        };
    }

    removeItem(TEACHER_STORAGE_KEY);
    return null;
}

export function saveTeacherSession(sessionData: TeacherSessionRecord): void {
    writeJsonItem(TEACHER_STORAGE_KEY, sessionData);
}

export function clearTeacherSession(): void {
    removeItem(TEACHER_STORAGE_KEY);
}

export function loadPlayerSession(code: string): PlayerSessionRecord | null {
    const parsed = readJsonItem(playerStorageKey(code));
    if (
        isRecord(parsed) &&
        typeof parsed.playerId === "string" &&
        typeof parsed.playerToken === "string"
    ) {
        return {
            playerId: parsed.playerId,
            playerToken: parsed.playerToken,
        };
    }

    removeItem(playerStorageKey(code));
    return null;
}

export function savePlayerSession(code: string, sessionData: PlayerSessionRecord): void {
    writeJsonItem(playerStorageKey(code), sessionData);
}

export function clearPlayerSession(code: string): void {
    removeItem(playerStorageKey(code));
}
