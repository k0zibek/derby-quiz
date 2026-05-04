import { randomInt } from "node:crypto";

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type AppConfig = {
    port: number;
    clientOrigins: "*" | string[];
    maxPlayersPerSession: number;
    sessionTtlMs: number;
    cleanupIntervalMs: number;
    teacherAccessPin: string;
    teacherAccessPinIsGenerated: boolean;
};

function parseInteger(
    env: Env,
    key: string,
    fallback: number,
    { min, max }: { min: number; max?: number }
): number {
    const rawValue = env[key];
    if (rawValue == null || rawValue.trim() === "") return fallback;

    if (!/^-?\d+$/.test(rawValue.trim())) {
        throw new Error(`${key} must be an integer`);
    }

    const parsed = Number(rawValue);
    if (!Number.isSafeInteger(parsed) || parsed < min || (max != null && parsed > max)) {
        const maxMessage = max == null ? "" : ` and <= ${max}`;
        throw new Error(`${key} must be >= ${min}${maxMessage}`);
    }

    return parsed;
}

function parseAllowedOrigins(value: string | undefined): "*" | string[] {
    if (!value) return "*";

    const origins = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    return origins.length > 0 ? origins : "*";
}

function resolveTeacherAccessPin(env: Env) {
    const configuredPin = typeof env.TEACHER_ACCESS_PIN === "string" ? env.TEACHER_ACCESS_PIN.trim() : "";
    if (configuredPin) {
        return {
            value: configuredPin,
            generated: false,
        };
    }

    return {
        value: String(randomInt(100000, 999999)),
        generated: true,
    };
}

export function loadConfig(env: Env = process.env): AppConfig {
    const teacherAccessPin = resolveTeacherAccessPin(env);

    return {
        port: parseInteger(env, "PORT", 4000, { min: 1, max: 65535 }),
        clientOrigins: parseAllowedOrigins(env.CLIENT_ORIGINS),
        maxPlayersPerSession: parseInteger(env, "MAX_PLAYERS_PER_SESSION", 50, { min: 1 }),
        sessionTtlMs: parseInteger(env, "SESSION_TTL_MS", 1000 * 60 * 60 * 4, { min: 1 }),
        cleanupIntervalMs: parseInteger(env, "SESSION_CLEANUP_INTERVAL_MS", 1000 * 60 * 5, { min: 1 }),
        teacherAccessPin: teacherAccessPin.value,
        teacherAccessPinIsGenerated: teacherAccessPin.generated,
    };
}
