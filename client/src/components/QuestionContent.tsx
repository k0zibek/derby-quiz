import { createElement, type ReactNode } from "react";

import type { PublicQuestion, QuestionOption, TeacherQuestion } from "../../../shared/types";

type QuestionLike = PublicQuestion | TeacherQuestion;
type HeadingTag = "h2" | "h3";

function getOptionLetter(index: number, option: QuestionOption): string {
    return option.label || String.fromCharCode(65 + index);
}

export function QuestionOptionContent({
    option,
    index,
    imageAlt,
}: {
    option: QuestionOption;
    index: number;
    imageAlt?: (label: string) => string;
}) {
    const label = getOptionLetter(index, option);

    return (
        <div className="option-body">
            <span className="option-letter">{label}</span>
            <div className="option-stack">
                {option.image ? (
                    <img
                        className="question-option-image"
                        src={option.image}
                        alt={imageAlt ? imageAlt(label) : `${label} option`}
                        loading="lazy"
                    />
                ) : null}
                {option.text ? <div className="option-text">{option.text}</div> : null}
            </div>
        </div>
    );
}

export function QuestionContent({
    question,
    badge,
    titleTag: TitleTag = "h2",
    titleClassName = "question-title",
    questionImageAlt = "Question material",
    children,
}: {
    question: QuestionLike | null;
    badge?: string;
    titleTag?: HeadingTag;
    titleClassName?: string;
    questionImageAlt?: string;
    children?: ReactNode;
}) {
    if (!question) return null;

    const titleNode = question.stem
        ? createElement(
            TitleTag,
            {
                className: `${titleClassName}${question.image || question.passage ? " mt-16" : ""}`,
            },
            question.stem
        )
        : null;

    return (
        <div className="question-box">
            {badge ? <div className="badge badge-light">{badge}</div> : null}

            {question.passageTitle || question.passage ? (
                <div className="passage-box mt-16">
                    {question.passageTitle ? (
                        <div className="passage-title">{question.passageTitle}</div>
                    ) : null}
                    {question.passage ? (
                        <div className="passage-text">
                            {question.passage.split("\n").map((line, lineIndex) => (
                                <p key={`${lineIndex}-${line.slice(0, 24)}`}>{line}</p>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {question.image ? (
                <img className="question-media mt-16" src={question.image} alt={questionImageAlt} loading="lazy" />
            ) : null}

            {titleNode}

            {children}
        </div>
    );
}
