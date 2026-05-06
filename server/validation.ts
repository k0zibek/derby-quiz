import { z } from "zod";

export const teacherCreateSessionPayloadSchema = z.object({
    accessPin: z.string().optional(),
    questionSetId: z.string().min(1),
});

export const teacherAccessPayloadSchema = z.object({
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

export const textQuestionDraftSchema = z.object({
    id: z.string().trim().min(1).optional(),
    stem: z.string().trim().min(1),
    options: z
        .array(z.string().trim().min(1))
        .min(2)
        .max(6),
    correctIndex: z.number().int().nonnegative(),
}).superRefine((question, context) => {
    if (question.correctIndex >= question.options.length) {
        context.addIssue({
            code: "custom",
            message: "correctIndex must point to an existing option",
            path: ["correctIndex"],
        });
    }
});

export const questionSetDraftSchema = z.object({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).max(120),
    questions: z.array(textQuestionDraftSchema).min(1),
});

export const questionSetCreatePayloadSchema = z.object({
    accessPin: z.string().optional(),
    questionSet: questionSetDraftSchema,
});

export const questionSetUpdatePayloadSchema = z.object({
    accessPin: z.string().optional(),
    questionSetId: z.string().min(1),
    questionSet: questionSetDraftSchema,
});

export const questionSetDeletePayloadSchema = z.object({
    accessPin: z.string().optional(),
    questionSetId: z.string().min(1),
});

export const addSessionQuestionPayloadSchema = z.object({
    code: z.string().min(1),
    teacherToken: z.string().min(1),
    question: textQuestionDraftSchema,
});

export function formatPayloadError(): { ok: false; code: string; error: string } {
    return {
        ok: false,
        code: "INVALID_PAYLOAD",
        error: "Invalid request payload",
    };
}
