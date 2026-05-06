import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
    AckResponse,
    GameStatus,
    QuestionSet,
    QuestionSetDraft,
    QuestionSetSummary,
    TextQuestionDraft,
} from "../../../shared/types";
import { Button, InlineNotice, Modal, Panel, Progress, QrBlock, StatusPill } from "../components/ui";
import { QuestionContent, QuestionOptionContent } from "../components/QuestionContent";
import { getConnectionMessage, getSocketErrorMessage, kz } from "../i18n/kz";
import { useConnectionState, useSessionState, useTeacherActions } from "../hooks/sessionHooks";
import { sessionClient } from "../sessionClient";
import { clearTeacherSession, loadTeacherSession, saveTeacherSession } from "../sessionStorage";

type PrimaryAction = {
    label: string;
    tone: "success" | "warning" | "primary";
    disabled: boolean;
    run: () => Promise<AckResponse>;
    hint: string;
};

const emptyQuestion = (): TextQuestionDraft => ({
    stem: "",
    options: ["", ""],
    correctIndex: 0,
});

const emptyQuestionSet = (): QuestionSetDraft => ({
    title: "",
    questions: [emptyQuestion()],
});

function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
}

function getStatusTone(status: GameStatus | undefined): "blue" | "green" | "amber" | "neutral" {
    if (status === "question") return "blue";
    if (status === "result") return "amber";
    if (status === "finished") return "green";
    return "neutral";
}

function toDraft(questionSet: QuestionSet): QuestionSetDraft {
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

function isDraftReady(draft: QuestionSetDraft): boolean {
    return Boolean(
        draft.title.trim() &&
        draft.questions.length > 0 &&
        draft.questions.every((question) => (
            question.stem.trim() &&
            question.options.length >= 2 &&
            question.options.length <= 6 &&
            question.options.every((option) => option.trim()) &&
            question.correctIndex >= 0 &&
            question.correctIndex < question.options.length
        ))
    );
}

function isQuestionReady(question: TextQuestionDraft): boolean {
    return Boolean(
        question.stem.trim() &&
        question.options.length >= 2 &&
        question.options.length <= 6 &&
        question.options.every((option) => option.trim()) &&
        question.correctIndex >= 0 &&
        question.correctIndex < question.options.length
    );
}

export default function TeacherPage() {
    const [accessPin, setAccessPin] = useState("");
    const [libraryAuthorized, setLibraryAuthorized] = useState(false);
    const [questionSets, setQuestionSets] = useState<QuestionSetSummary[]>([]);
    const [selectedSetId, setSelectedSetId] = useState("");
    const [editingSet, setEditingSet] = useState<QuestionSetDraft>(emptyQuestionSet);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [libraryError, setLibraryError] = useState("");
    const [libraryNotice, setLibraryNotice] = useState("");
    const [code, setCode] = useState("");
    const [teacherToken, setTeacherToken] = useState("");
    const [session, setSession] = useSessionState("teacher");
    const [isRestoring, setIsRestoring] = useState(() => Boolean(loadTeacherSession()));
    const [error, setError] = useState("");
    const [resetOpen, setResetOpen] = useState(false);
    const [adaptiveQuestion, setAdaptiveQuestion] = useState<TextQuestionDraft>(emptyQuestion);
    const restoreInFlightRef = useRef(false);
    const { connectionState, serverUrl } = useConnectionState();
    const actions = useTeacherActions(code, teacherToken);

    const restoreSession = useCallback(async () => {
        const storedSession = loadTeacherSession();
        if (!storedSession || restoreInFlightRef.current) {
            setIsRestoring(false);
            return;
        }

        restoreInFlightRef.current = true;
        setIsRestoring(true);

        const response = await sessionClient.joinTeacherSession(storedSession.code, storedSession.teacherToken);
        restoreInFlightRef.current = false;

        if (response?.ok) {
            setCode(storedSession.code);
            setTeacherToken(storedSession.teacherToken);
            setError("");
            setIsRestoring(false);
            return;
        }

        if (response?.code === "UNAUTHORIZED" || response?.code === "SESSION_NOT_FOUND") {
            clearTeacherSession();
            setCode("");
            setTeacherToken("");
            setSession(null);
            setError("");
        } else if (
            response?.code !== "SOCKET_CONNECT_TIMEOUT" &&
            response?.code !== "SOCKET_CONNECT_ERROR" &&
            response?.code !== "ACK_TIMEOUT"
        ) {
            setError(getSocketErrorMessage(response) || kz.errors.createSession);
        }

        setIsRestoring(false);
    }, [setSession]);

    useEffect(() => {
        void Promise.resolve().then(restoreSession);
    }, [restoreSession]);

    useEffect(() => {
        if (connectionState === "connected") {
            void Promise.resolve().then(restoreSession);
        }
    }, [connectionState, restoreSession]);

    const refreshQuestionSets = useCallback(async (pin = accessPin) => {
        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.listQuestionSets(pin.trim());
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response));
            return false;
        }

        setQuestionSets(response.questionSets);
        setLibraryAuthorized(true);
        setSelectedSetId((current) => current || response.questionSets[0]?.id || "");
        return true;
    }, [accessPin]);

    const joinUrl = useMemo(() => (code ? `${window.location.origin}/join/${code}` : ""), [code]);
    const screenUrl = useMemo(() => (code ? `${window.location.origin}/screen/${code}` : ""), [code]);
    const currentQuestionNumber = (session?.currentQuestionIndex ?? 0) + 1;
    const totalQuestions = session?.totalQuestions ?? 0;
    const connectionMessage = getConnectionMessage(connectionState, serverUrl);
    const hasActiveSession = Boolean(code && teacherToken);
    const selectedSet = questionSets.find((questionSet) => questionSet.id === selectedSetId) ?? null;

    async function handleAction(action: () => Promise<AckResponse>) {
        setError("");
        const res = await action();

        if (!res?.ok) {
            if (res?.code === "UNAUTHORIZED" || res?.code === "SESSION_NOT_FOUND") {
                clearTeacherSession();
                setCode("");
                setTeacherToken("");
                setSession(null);
                setIsRestoring(false);
            }

            setError(getSocketErrorMessage(res) || kz.errors.operationFailed);
        }
    }

    async function handleTeacherAccess() {
        if (!accessPin.trim()) {
            setLibraryError(kz.network.teacherAccessDenied);
            return;
        }

        await refreshQuestionSets(accessPin);
    }

    async function handleEditSelected() {
        if (!selectedSetId) return;

        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.updateQuestionSet(accessPin.trim(), selectedSetId, editingSet);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response));
            return;
        }

        setEditingSet(toDraft(response.questionSet));
        setLibraryNotice(kz.teacherLibrary.saved);
        await refreshQuestionSets(accessPin);
    }

    async function handleSaveNew() {
        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.createQuestionSet(accessPin.trim(), editingSet);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response));
            return;
        }

        setEditingSet(toDraft(response.questionSet));
        setSelectedSetId(response.questionSet.id);
        setLibraryNotice(kz.teacherLibrary.saved);
        await refreshQuestionSets(accessPin);
    }

    async function handleLoadQuestionSet(questionSetId: string) {
        setSelectedSetId(questionSetId);
        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.getQuestionSet(accessPin.trim(), questionSetId);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response));
            return;
        }

        setEditingSet(toDraft(response.questionSet));
    }


    async function handleDeleteSelected() {
        if (!selectedSetId || !window.confirm(kz.teacherLibrary.deleteConfirm)) return;

        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.deleteQuestionSet(accessPin.trim(), selectedSetId);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response));
            return;
        }

        setSelectedSetId("");
        setEditingSet(emptyQuestionSet());
        setLibraryNotice(kz.teacherLibrary.deleted);
        await refreshQuestionSets(accessPin);
    }

    async function handleStartSession() {
        if (!selectedSetId) {
            setLibraryError(kz.teacherLibrary.selectSet);
            return;
        }

        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.createTeacherSession(accessPin.trim(), selectedSetId);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response));
            return;
        }

        saveTeacherSession({
            code: response.code,
            teacherToken: response.teacherToken,
        });
        setCode(response.code);
        setTeacherToken(response.teacherToken);
    }

    async function handleAddAdaptiveQuestion() {
        if (!isQuestionReady(adaptiveQuestion)) {
            setError(kz.teacherLibrary.fillQuestion);
            return;
        }

        setError("");
        const response = await actions.addQuestion(adaptiveQuestion);
        if (!response?.ok) {
            setError(getSocketErrorMessage(response));
            return;
        }

        setAdaptiveQuestion(emptyQuestion());
    }

    function updateQuestion(questionIndex: number, nextQuestion: TextQuestionDraft) {
        setEditingSet((current) => ({
            ...current,
            questions: current.questions.map((question, index) => index === questionIndex ? nextQuestion : question),
        }));
    }

    function updateAdaptiveOption(optionIndex: number, value: string) {
        setAdaptiveQuestion((current) => ({
            ...current,
            options: current.options.map((option, index) => index === optionIndex ? value : option),
        }));
    }

    const primaryAction: PrimaryAction = session?.canStart
        ? {
              label: kz.buttons.startQuestion,
              tone: "success",
              disabled: false,
              run: actions.startQuestion,
              hint: kz.teacher.nextActionStart,
          }
        : session?.canShowResults
          ? {
                label: kz.buttons.showResults,
                tone: "warning",
                disabled: false,
                run: actions.showResults,
                hint: kz.teacher.nextActionResults,
            }
          : session?.canGoNext
            ? {
                  label: kz.buttons.nextQuestion,
                  tone: "primary",
                  disabled: false,
                  run: actions.nextQuestion,
                  hint: kz.teacher.nextActionNext,
              }
            : {
                  label: kz.teacher.waitingAction,
                  tone: "primary",
                  disabled: true,
                  run: async () => ({ ok: true }),
                  hint: kz.teacher.nextActionWait,
              };

    if (!hasActiveSession && !libraryAuthorized) {
        return (
            <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
                <Panel className="w-full max-w-md p-6">
                    <StatusPill tone="blue">{kz.teacher.kicker}</StatusPill>
                    <h1 className="mt-5 text-3xl font-black leading-tight text-slate-950">
                        {isRestoring ? kz.teacher.restoreTitle : kz.teacher.accessTitle}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        {isRestoring ? kz.teacher.restoreSubtitle : kz.teacher.accessSubtitle}
                    </p>

                    {isRestoring ? (
                        <InlineNotice>{kz.teacher.restoreHint}</InlineNotice>
                    ) : (
                        <div className="mt-5 grid gap-3">
                            <input
                                className="h-14 rounded-xl border border-slate-200 bg-white px-4 text-base font-semibold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                placeholder={kz.teacher.accessPlaceholder}
                                value={accessPin}
                                onChange={(event) => setAccessPin(event.target.value)}
                                maxLength={32}
                            />
                            <Button onClick={handleTeacherAccess} disabled={libraryLoading}>
                                {libraryLoading ? kz.buttons.connecting : kz.buttons.authorizeTeacher}
                            </Button>
                        </div>
                    )}

                    <div className="mt-4 grid gap-3">
                        {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                        {libraryError || error ? <InlineNotice tone="danger">{libraryError || error}</InlineNotice> : null}
                    </div>
                </Panel>
            </main>
        );
    }

    if (!hasActiveSession) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
                <div className="mx-auto grid w-full max-w-7xl gap-5">
                    <header className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <StatusPill tone="blue">{kz.teacherLibrary.kicker}</StatusPill>
                            <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">{kz.teacherLibrary.title}</h1>
                        </div>
                        <Button tone="neutral" onClick={() => setEditingSet(emptyQuestionSet())}>
                            {kz.teacherLibrary.newSet}
                        </Button>
                    </header>

                    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
                        <Panel className="grid content-start gap-4">
                            <div>
                                <h2 className="text-lg font-black">{kz.teacherLibrary.setsTitle}</h2>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{kz.teacherLibrary.setsSubtitle}</p>
                            </div>
                            <div className="grid gap-2">
                                {questionSets.map((questionSet) => (
                                    <button
                                        key={questionSet.id}
                                        className={`rounded-xl border p-3 text-left transition ${
                                            selectedSetId === questionSet.id
                                                ? "border-sky-300 bg-sky-50"
                                                : "border-slate-200 bg-white hover:bg-slate-50"
                                        }`}
                                        onClick={() => {
                                            void handleLoadQuestionSet(questionSet.id);
                                        }}
                                    >
                                        <div className="font-black">{questionSet.title}</div>
                                        <div className="mt-1 text-sm font-semibold text-slate-500">
                                            {questionSet.questionCount} {kz.labels.question.toLowerCase()}
                                        </div>
                                    </button>
                                ))}
                                {questionSets.length ? null : <InlineNotice>{kz.teacherLibrary.empty}</InlineNotice>}
                            </div>
                            <Button tone="success" disabled={!selectedSet || libraryLoading} onClick={handleStartSession}>
                                {kz.teacherLibrary.startGame}
                            </Button>
                            <Button tone="danger" disabled={!selectedSetId || libraryLoading} onClick={handleDeleteSelected}>
                                {kz.teacherLibrary.deleteSet}
                            </Button>
                        </Panel>

                        <Panel className="grid gap-5">
                            <div>
                                <div className="text-sm font-bold text-slate-500">{kz.teacherLibrary.editorTitle}</div>
                                <input
                                    className="mt-2 h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-xl font-black outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                    placeholder={kz.teacherLibrary.titlePlaceholder}
                                    value={editingSet.title}
                                    onChange={(event) => setEditingSet((current) => ({ ...current, title: event.target.value }))}
                                />
                            </div>

                            <div className="grid gap-4">
                                {editingSet.questions.map((question, questionIndex) => (
                                    <div key={question.id ?? questionIndex} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <StatusPill>{kz.labels.question} {questionIndex + 1}</StatusPill>
                                            <Button
                                                tone="neutral"
                                                disabled={editingSet.questions.length <= 1}
                                                onClick={() => setEditingSet((current) => ({
                                                    ...current,
                                                    questions: current.questions.filter((_, index) => index !== questionIndex),
                                                }))}
                                            >
                                                {kz.teacherLibrary.removeQuestion}
                                            </Button>
                                        </div>
                                        <textarea
                                            className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                            placeholder={kz.teacherLibrary.stemPlaceholder}
                                            value={question.stem}
                                            onChange={(event) => updateQuestion(questionIndex, { ...question, stem: event.target.value })}
                                        />
                                        <div className="mt-3 grid gap-2">
                                            {question.options.map((option, optionIndex) => (
                                                <div key={optionIndex} className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        checked={question.correctIndex === optionIndex}
                                                        onChange={() => updateQuestion(questionIndex, { ...question, correctIndex: optionIndex })}
                                                        aria-label={`${kz.teacherLibrary.correctOption} ${optionIndex + 1}`}
                                                    />
                                                    <input
                                                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                                        placeholder={`${kz.teacherLibrary.optionPlaceholder} ${optionIndex + 1}`}
                                                        value={option}
                                                        onChange={(event) => updateQuestion(questionIndex, {
                                                            ...question,
                                                            options: question.options.map((item, index) => index === optionIndex ? event.target.value : item),
                                                        })}
                                                    />
                                                    <Button
                                                        tone="neutral"
                                                        disabled={question.options.length <= 2}
                                                        onClick={() => updateQuestion(questionIndex, {
                                                            ...question,
                                                            options: question.options.filter((_, index) => index !== optionIndex),
                                                            correctIndex: Math.min(question.correctIndex, question.options.length - 2),
                                                        })}
                                                    >
                                                        {kz.teacherLibrary.removeOption}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                        <Button
                                            tone="neutral"
                                            className="mt-3"
                                            disabled={question.options.length >= 6}
                                            onClick={() => updateQuestion(questionIndex, {
                                                ...question,
                                                options: [...question.options, ""],
                                            })}
                                        >
                                            {kz.teacherLibrary.addOption}
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Button
                                    tone="neutral"
                                    onClick={() => setEditingSet((current) => ({
                                        ...current,
                                        questions: [...current.questions, emptyQuestion()],
                                    }))}
                                >
                                    {kz.teacherLibrary.addQuestion}
                                </Button>
                                <Button
                                    tone="success"
                                    disabled={!isDraftReady(editingSet) || libraryLoading}
                                    onClick={editingSet.id && selectedSetId === editingSet.id ? handleEditSelected : handleSaveNew}
                                >
                                    {kz.teacherLibrary.saveSet}
                                </Button>
                            </div>

                            <div className="grid gap-3">
                                {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                                {libraryNotice ? <InlineNotice tone="success">{libraryNotice}</InlineNotice> : null}
                                {libraryError ? <InlineNotice tone="danger">{libraryError}</InlineNotice> : null}
                            </div>
                        </Panel>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
            <div className="mx-auto grid w-full max-w-7xl gap-5">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <StatusPill tone={getStatusTone(session?.status)}>{session ? kz.states[session.status].text : kz.states.lobby.text}</StatusPill>
                        <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">{kz.appName}</h1>
                    </div>
                    <a
                        href={screenUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold transition hover:bg-slate-800 text-white!"
                    >
                        {kz.buttons.openScreen}
                    </a>
                </header>

                <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
                    <Panel className="grid content-start gap-5">
                        <QrBlock value={joinUrl} code={code} label={kz.labels.code} />
                        <div className="grid grid-cols-2 gap-3">
                            <Button tone="neutral" onClick={() => copyText(joinUrl)} disabled={!joinUrl}>
                                {kz.buttons.copyLink}
                            </Button>
                            <Button tone="neutral" onClick={() => copyText(screenUrl)} disabled={!screenUrl}>
                                {kz.buttons.copyScreen}
                            </Button>
                        </div>
                        <div className="rounded-xl bg-slate-100 p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{kz.labels.players}</div>
                            <div className="mt-1 text-4xl font-black">{session?.totalPlayers ?? 0}</div>
                        </div>
                    </Panel>

                    <div className="grid gap-5">
                        <Panel className="grid gap-5">
                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                                <div>
                                    <div className="text-sm font-bold text-slate-500">{kz.teacher.nextActionLabel}</div>
                                    <h2 className="mt-2 text-3xl font-black leading-tight">{primaryAction.label}</h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{primaryAction.hint}</p>
                                </div>
                                <Button
                                    tone={primaryAction.tone}
                                    className="min-h-16 text-base"
                                    disabled={primaryAction.disabled}
                                    onClick={() => handleAction(primaryAction.run)}
                                >
                                    {primaryAction.label}
                                </Button>
                            </div>

                            <div className="grid gap-3">
                                {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                                {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                            </div>
                        </Panel>

                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                            <Panel>
                                {session?.currentQuestion ? (
                                    <QuestionContent
                                        question={session.currentQuestion}
                                        badge={`${kz.labels.question} ${currentQuestionNumber} / ${totalQuestions}`}
                                        titleTag="h3"
                                    >
                                        {session.status === "result" ? (
                                            <div className="mt-4 grid gap-3">
                                                {session.currentQuestion.options.map((option, index) => {
                                                    const stat = session.optionStats?.find((item) => item.index === index);

                                                    return (
                                                        <div key={`${option.label}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <QuestionOptionContent option={option} index={index} />
                                                                <StatusPill tone={stat?.isCorrect ? "green" : "neutral"}>
                                                                    {stat?.count ?? 0}
                                                                </StatusPill>
                                                            </div>
                                                            <Progress
                                                                className="mt-3"
                                                                value={
                                                                    session.totalPlayers
                                                                        ? ((stat?.count ?? 0) / session.totalPlayers) * 100
                                                                        : 0
                                                                }
                                                                color={stat?.isCorrect ? "#059669" : "#94a3b8"}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="mt-4">
                                                <Progress
                                                    value={
                                                        session.totalPlayers
                                                            ? (session.answeredCount / session.totalPlayers) * 100
                                                            : 0
                                                    }
                                                />
                                                <div className="mt-2 text-sm font-semibold text-slate-500">
                                                    {session.answeredCount} / {session.totalPlayers} {kz.labels.answered.toLowerCase()}
                                                </div>
                                            </div>
                                        )}
                                    </QuestionContent>
                                ) : (
                                    <InlineNotice>{kz.teacher.currentQuestionEmpty}</InlineNotice>
                                )}
                            </Panel>

                            <div className="grid gap-5">
                                {(session?.status === "lobby" || session?.status === "result") ? (
                                    <Panel className="grid gap-3">
                                        <div>
                                            <h2 className="text-lg font-black">{kz.teacherLibrary.adaptiveTitle}</h2>
                                            <p className="mt-1 text-sm leading-6 text-slate-600">{kz.teacherLibrary.adaptiveSubtitle}</p>
                                        </div>
                                        <textarea
                                            className="min-h-20 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                            placeholder={kz.teacherLibrary.stemPlaceholder}
                                            value={adaptiveQuestion.stem}
                                            onChange={(event) => setAdaptiveQuestion((current) => ({ ...current, stem: event.target.value }))}
                                        />
                                        {adaptiveQuestion.options.map((option, optionIndex) => (
                                            <div key={optionIndex} className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2">
                                                <input
                                                    type="radio"
                                                    checked={adaptiveQuestion.correctIndex === optionIndex}
                                                    onChange={() => setAdaptiveQuestion((current) => ({ ...current, correctIndex: optionIndex }))}
                                                    aria-label={`${kz.teacherLibrary.correctOption} ${optionIndex + 1}`}
                                                />
                                                <input
                                                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                                    placeholder={`${kz.teacherLibrary.optionPlaceholder} ${optionIndex + 1}`}
                                                    value={option}
                                                    onChange={(event) => updateAdaptiveOption(optionIndex, event.target.value)}
                                                />
                                            </div>
                                        ))}
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                tone="neutral"
                                                disabled={adaptiveQuestion.options.length >= 6}
                                                onClick={() => setAdaptiveQuestion((current) => ({
                                                    ...current,
                                                    options: [...current.options, ""],
                                                }))}
                                            >
                                                {kz.teacherLibrary.addOption}
                                            </Button>
                                            <Button
                                                tone="success"
                                                disabled={!isQuestionReady(adaptiveQuestion)}
                                                onClick={handleAddAdaptiveQuestion}
                                            >
                                                {kz.teacherLibrary.addToQueue}
                                            </Button>
                                        </div>
                                    </Panel>
                                ) : null}

                                <Panel>
                                    <div className="flex items-center justify-between gap-3">
                                        <h2 className="text-lg font-black">{kz.teacher.rosterTitle}</h2>
                                        <StatusPill>{session?.players.length ?? 0}</StatusPill>
                                    </div>
                                    <div className="mt-4 grid gap-2">
                                        {(session?.players ?? []).slice(0, 8).map((player) => (
                                            <div key={player.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                                                <span
                                                    className="h-3 w-3 rounded-full"
                                                    style={{ background: player.color }}
                                                />
                                                <div className="min-w-0 flex-1 truncate text-sm font-bold">{player.name}</div>
                                                <div className="text-sm font-black">{player.score}</div>
                                            </div>
                                        ))}
                                        {session?.players.length ? null : <InlineNotice>{kz.screen.empty}</InlineNotice>}
                                    </div>
                                    <Button
                                        tone="danger"
                                        className="mt-5 w-full"
                                        disabled={!session?.canReset}
                                        onClick={() => setResetOpen(true)}
                                    >
                                        {kz.buttons.resetGame}
                                    </Button>
                                </Panel>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={resetOpen}
                title={kz.teacher.resetTitle}
                confirmLabel={kz.buttons.resetGame}
                cancelLabel={kz.buttons.cancel}
                onCancel={() => setResetOpen(false)}
                onConfirm={() => {
                    setResetOpen(false);
                    void handleAction(actions.resetGame);
                }}
            >
                {kz.teacher.resetBody}
            </Modal>
        </main>
    );
}
