import { z } from "zod";

export const teacherCreateSessionPayloadSchema = z.object({
    accessPin: z.string().optional(),
});

export const teacherSessionPayloadSchema = z.object({
    code: z.string().min(1),
    teacherToken: z.string().min(1),
});

export const screenJoinPayloadSchema = z.object({
    code: z.string().min(1),
});

export const playerJoinPayloadSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
});

export const playerRejoinPayloadSchema = z.object({
    code: z.string().min(1),
    playerId: z.string().min(1),
    playerToken: z.string().min(1),
});

export const submitAnswerPayloadSchema = z.object({
    code: z.string().min(1),
    playerId: z.string().min(1),
    playerToken: z.string().min(1),
    optionIndex: z.number().int().nonnegative(),
});

export function formatPayloadError(): { ok: false; code: string; error: string } {
    return {
        ok: false,
        code: "INVALID_PAYLOAD",
        error: "Invalid request payload",
    };
}
