import rawQuestions from "../questions.json" with { type: "json" };

export function normalizeQuestion(question, index) {
    return {
        id: `q${index + 1}`,
        text: question.q,
        options: question.a,
        correctIndex: question.c,
    };
}

function validateQuestion(question, index) {
    if (typeof question.q !== "string" || question.q.trim() === "") {
        throw new Error(`Question ${index + 1} must have non-empty text`);
    }

    if (!Array.isArray(question.a) || question.a.length < 2) {
        throw new Error(`Question ${index + 1} must have at least two options`);
    }

    if (!Number.isInteger(question.c) || question.c < 0 || question.c >= question.a.length) {
        throw new Error(`Question ${index + 1} has invalid correctIndex`);
    }
}

export function loadQuestions(source = rawQuestions) {
    if (!Array.isArray(source) || source.length === 0) {
        throw new Error("Questions source must be a non-empty array");
    }

    return source.map((question, index) => {
        validateQuestion(question, index);
        return normalizeQuestion(question, index);
    });
}

export const questions = loadQuestions();
