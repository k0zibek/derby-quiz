const TEACHER_STORAGE_KEY = "horse-quiz-teacher";

function hasStorage() {
    return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJsonItem(key) {
    if (!hasStorage()) return null;

    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return null;

    try {
        return JSON.parse(rawValue);
    } catch {
        window.localStorage.removeItem(key);
        return null;
    }
}

function writeJsonItem(key, value) {
    if (!hasStorage()) return;
    window.localStorage.setItem(key, JSON.stringify(value));
}

function removeItem(key) {
    if (!hasStorage()) return;
    window.localStorage.removeItem(key);
}

function playerStorageKey(code) {
    return `horse-quiz-player:${code}`;
}

export function loadTeacherSession() {
    const parsed = readJsonItem(TEACHER_STORAGE_KEY);
    if (parsed?.code && parsed?.teacherToken) {
        return parsed;
    }

    removeItem(TEACHER_STORAGE_KEY);
    return null;
}

export function saveTeacherSession(sessionData) {
    writeJsonItem(TEACHER_STORAGE_KEY, sessionData);
}

export function clearTeacherSession() {
    removeItem(TEACHER_STORAGE_KEY);
}

export function loadPlayerSession(code) {
    const parsed = readJsonItem(playerStorageKey(code));
    if (parsed?.playerId && parsed?.playerToken) {
        return parsed;
    }

    removeItem(playerStorageKey(code));
    return null;
}

export function savePlayerSession(code, sessionData) {
    writeJsonItem(playerStorageKey(code), sessionData);
}

export function clearPlayerSession(code) {
    removeItem(playerStorageKey(code));
}
