import assert from "node:assert/strict";
import test from "node:test";

import { normalizeQuestion, validateQuestionSet } from "../questions.js";

test("normalizeQuestion supports reading questions with passages and images", () => {
    const question = normalizeQuestion(
        {
            id: "reading-1",
            type: "reading_mcq",
            stem: "Мәтін бойынша дұрыс жауапты таңдаңыз.",
            passageTitle: "Абсент",
            passage: "Абсент туралы мәтін",
            image: "/question-assets/modo-4e/image1.png",
            options: [
                { label: "A", text: "Бірінші жауап", image: null },
                { label: "B", text: null, image: "/question-assets/modo-4e/image2.png" },
            ],
            correctIndex: 1,
            groupId: "reading-absent",
            sourceMeta: {
                section: "Оқу сауаттылығы",
                itemNumber: "1",
                source: "МОДО №2 4Е",
            },
        },
        0,
        { assetExists: () => true }
    );

    assert.equal(question.type, "reading_mcq");
    assert.equal(question.passageTitle, "Абсент");
    assert.equal(question.image, "/question-assets/modo-4e/image1.png");
    assert.equal(question.options[1].image, "/question-assets/modo-4e/image2.png");
    assert.equal(question.correctIndex, 1);
});

test("validateQuestionSet rejects empty stems and prompts without images", () => {
    assert.throws(() => {
        validateQuestionSet(
            [
                {
                    id: "bad-question",
                    type: "mcq",
                    stem: "",
                    options: [
                        { label: "A", text: "Бір", image: null },
                        { label: "B", text: "Екі", image: null },
                    ],
                    correctIndex: 0,
                },
            ],
            { assetExists: () => true }
        );
    }, /must have either stem or image/);
});

test("validateQuestionSet rejects invalid correctIndex", () => {
    assert.throws(() => {
        validateQuestionSet(
            [
                {
                    id: "bad-index",
                    type: "mcq",
                    stem: "Дұрыс жауапты таңдаңыз",
                    options: [
                        { label: "A", text: "Иә", image: null },
                        { label: "B", text: "Жоқ", image: null },
                    ],
                    correctIndex: 4,
                },
            ],
            { assetExists: () => true }
        );
    }, /invalid correctIndex/);
});

test("validateQuestionSet rejects broken image links", () => {
    assert.throws(() => {
        validateQuestionSet(
            [
                {
                    id: "broken-image",
                    type: "image_mcq",
                    stem: "Суретті қараңыз",
                    image: "/question-assets/modo-4e/missing.png",
                    options: [
                        { label: "A", text: "Бір", image: null },
                        { label: "B", text: "Екі", image: null },
                    ],
                    correctIndex: 0,
                },
            ],
            { assetExists: () => false }
        );
    }, /asset was not found/);
});
