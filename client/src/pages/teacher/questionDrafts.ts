import type { QuestionSet, QuestionSetDraft, TextQuestionDraft } from "../../../../shared/types";

export const createEmptyQuestion = (): TextQuestionDraft => ({
    stem: "",
    options: ["", ""],
    correctIndex: 0,
});

export const createEmptyQuestionSet = (): QuestionSetDraft => ({
    title: "",
    questions: [createEmptyQuestion()],
});

export function toQuestionSetDraft(questionSet: QuestionSet): QuestionSetDraft {
    return {
        id: questionSet.id,
        title: questionSet.title,
        questions: questionSet.questions.map((question) => ({
            id: question.id,
            stem: question.stem ?? "",
            options: question.options.map((option) => option.text ?? ""),
            correctIndex: question.correctIndex,
        })),
    };
}

export function isTextQuestionDraftReady(question: TextQuestionDraft): boolean {
    return Boolean(
        question.stem.trim() &&
        question.options.length >= 2 &&
        question.options.length <= 6 &&
        question.options.every((option) => option.trim()) &&
        question.correctIndex >= 0 &&
        question.correctIndex < question.options.length
    );
}

export function isQuestionSetDraftReady(draft: QuestionSetDraft): boolean {
    return Boolean(
        draft.title.trim() &&
        draft.questions.length > 0 &&
        draft.questions.every(isTextQuestionDraftReady)
    );
}
