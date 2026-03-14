import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import rawQuestions from "../questions.json" with { type: "json" };

const VALID_TYPES = new Set(["mcq", "reading_mcq", "image_mcq"]);
const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];
const publicDir = fileURLToPath(new URL("../client/public", import.meta.url));

function normalizeText(value) {
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function assertAssetPath(value, { assetExists }) {
    if (value == null) return null;
    if (typeof value !== "string" || !value.startsWith("/")) {
        throw new Error(`Question asset path must start with "/": ${String(value)}`);
    }

    const resolvedPath = path.resolve(publicDir, `.${value}`);
    if (!resolvedPath.startsWith(publicDir)) {
        throw new Error(`Question asset path escapes public directory: ${value}`);
    }

    if (!assetExists(resolvedPath)) {
        throw new Error(`Question asset was not found: ${value}`);
    }

    return value;
}

function normalizeSourceMeta(sourceMeta) {
    if (sourceMeta == null) return null;
    if (typeof sourceMeta !== "object" || Array.isArray(sourceMeta)) {
        throw new Error("Question sourceMeta must be an object");
    }

    return {
        section: normalizeText(sourceMeta.section),
        itemNumber: normalizeText(String(sourceMeta.itemNumber ?? "")),
        source: normalizeText(sourceMeta.source),
    };
}

function normalizeOption(option, index, { assetExists }) {
    if (typeof option === "string") {
        const text = normalizeText(option);
        if (!text) {
            throw new Error(`Question option #${index + 1} must not be empty`);
        }

        return {
            label: OPTION_LABELS[index] || String(index + 1),
            text,
            image: null,
        };
    }

    if (!option || typeof option !== "object" || Array.isArray(option)) {
        throw new Error(`Question option #${index + 1} must be a string or object`);
    }

    const label = normalizeText(option.label) || OPTION_LABELS[index] || String(index + 1);
    const text = normalizeText(option.text);
    const image = assertAssetPath(option.image ?? null, { assetExists });

    if (!text && !image) {
        throw new Error(`Question option #${index + 1} must have text or image`);
    }

    return { label, text, image };
}

export function normalizeQuestion(question, index, options = {}) {
    const { assetExists = fs.existsSync } = options;

    if (!question || typeof question !== "object" || Array.isArray(question)) {
        throw new Error(`Question #${index + 1} must be an object`);
    }

    const id = normalizeText(question.id) || `q${index + 1}`;
    const type = normalizeText(question.type) || "mcq";
    if (!VALID_TYPES.has(type)) {
        throw new Error(`Question "${id}" has unsupported type "${type}"`);
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
        throw new Error(`Question "${id}" must have at least 2 options`);
    }

    const stem = normalizeText(question.stem);
    const passageTitle = normalizeText(question.passageTitle);
    const passage = normalizeText(question.passage);
    const image = assertAssetPath(question.image ?? null, { assetExists });
    const groupId = normalizeText(question.groupId);
    const sourceMeta = normalizeSourceMeta(question.sourceMeta);
    const normalizedOptions = question.options.map((option, optionIndex) =>
        normalizeOption(option, optionIndex, { assetExists })
    );

    if (!stem && !image) {
        throw new Error(`Question "${id}" must have either stem or image`);
    }

    const correctIndex = Number(question.correctIndex);
    if (
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= normalizedOptions.length
    ) {
        throw new Error(`Question "${id}" has invalid correctIndex "${question.correctIndex}"`);
    }

    return {
        id,
        type,
        stem,
        passageTitle,
        passage,
        image,
        options: normalizedOptions,
        correctIndex,
        groupId,
        sourceMeta,
    };
}

export function validateQuestionSet(questionSet, options = {}) {
    if (!Array.isArray(questionSet) || questionSet.length === 0) {
        throw new Error("Question set must be a non-empty array");
    }

    return questionSet.map((question, index) => normalizeQuestion(question, index, options));
}

export const questions = validateQuestionSet(rawQuestions);
