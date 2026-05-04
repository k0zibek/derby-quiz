import { randomInt } from "node:crypto";
import path from "node:path";
import { z } from "zod";

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type AppConfig = {
    port: number;
    clientOrigins: "*" | string[];
    maxPlayersPerSession: number;
    sessionTtlMs: number;
    cleanupIntervalMs: number;
    teacherAccessPin: string;
    teacherAccessPinIsGenerated: boolean;
    databasePath: string;
    staticDir: string | null;
};

function integerEnv(key: string, fallback: number, { min, max }: { min: number; max?: number }) {
    return z
        .string()
        .optional()
        .transform((value) => {
            if (value == null || value.trim() === "") return fallback;
            if (!/^-?\d+$/.test(value.trim())) {
                throw new Error(`${key} must be an integer`);
            }

            const parsed = Number(value);
            if (!Number.isSafeInteger(parsed) || parsed < min || (max != null && parsed > max)) {
                const maxMessage = max == null ? "" : ` and <= ${max}`;
                throw new Error(`${key} must be >= ${min}${maxMessage}`);
            }

            return parsed;
        });
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
    const schema = z.object({
        PORT: integerEnv("PORT", 4000, { min: 1, max: 65535 }),
        CLIENT_ORIGINS: z.string().optional(),
        MAX_PLAYERS_PER_SESSION: integerEnv("MAX_PLAYERS_PER_SESSION", 50, { min: 1 }),
        SESSION_TTL_MS: integerEnv("SESSION_TTL_MS", 1000 * 60 * 60 * 4, { min: 1 }),
        SESSION_CLEANUP_INTERVAL_MS: integerEnv("SESSION_CLEANUP_INTERVAL_MS", 1000 * 60 * 5, { min: 1 }),
        CLASSROOM_DATABASE_PATH: z.string().optional(),
        CLASSROOM_STATIC_DIR: z.string().optional(),
    });

    const parsed = schema.parse(env);
    const teacherAccessPin = resolveTeacherAccessPin(env);

    return {
        port: parsed.PORT,
        clientOrigins: parseAllowedOrigins(parsed.CLIENT_ORIGINS),
        maxPlayersPerSession: parsed.MAX_PLAYERS_PER_SESSION,
        sessionTtlMs: parsed.SESSION_TTL_MS,
        cleanupIntervalMs: parsed.SESSION_CLEANUP_INTERVAL_MS,
        teacherAccessPin: teacherAccessPin.value,
        teacherAccessPinIsGenerated: teacherAccessPin.generated,
        databasePath: path.resolve(parsed.CLASSROOM_DATABASE_PATH ?? "data/classroom.sqlite"),
        staticDir: parsed.CLASSROOM_STATIC_DIR ? path.resolve(parsed.CLASSROOM_STATIC_DIR) : null,
    };
}
