function parseInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAllowedOrigins(value) {
    if (!value) return "*";

    const origins = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    return origins.length > 0 ? origins : "*";
}

export function loadConfig(env = process.env) {
    return {
        port: parseInteger(env.PORT, 4000),
        clientOrigins: parseAllowedOrigins(env.CLIENT_ORIGINS),
        maxPlayersPerSession: parseInteger(env.MAX_PLAYERS_PER_SESSION, 50),
        sessionTtlMs: parseInteger(env.SESSION_TTL_MS, 1000 * 60 * 60 * 4),
        cleanupIntervalMs: parseInteger(env.SESSION_CLEANUP_INTERVAL_MS, 1000 * 60 * 5),
    };
}
