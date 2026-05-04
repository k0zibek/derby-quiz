import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AckResponse, GameStatus } from "../../../shared/types";
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

function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
}

function getStatusTone(status: GameStatus | undefined): "blue" | "green" | "amber" | "neutral" {
    if (status === "question") return "blue";
    if (status === "result") return "amber";
    if (status === "finished") return "green";
    return "neutral";
}

export default function TeacherPage() {
    const [accessPin, setAccessPin] = useState("");
    const [code, setCode] = useState("");
    const [teacherToken, setTeacherToken] = useState("");
    const [session, setSession] = useSessionState("teacher");
    const [isRestoring, setIsRestoring] = useState(() => Boolean(loadTeacherSession()));
    const [error, setError] = useState("");
    const [resetOpen, setResetOpen] = useState(false);
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

    const joinUrl = useMemo(() => (code ? `${window.location.origin}/join/${code}` : ""), [code]);
    const screenUrl = useMemo(() => (code ? `${window.location.origin}/screen/${code}` : ""), [code]);
    const currentQuestionNumber = (session?.currentQuestionIndex ?? 0) + 1;
    const totalQuestions = session?.totalQuestions ?? 0;
    const connectionMessage = getConnectionMessage(connectionState, serverUrl);
    const isAuthorized = Boolean(code && teacherToken);

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
            setError(kz.network.teacherAccessDenied);
            return;
        }

        setError("");
        restoreInFlightRef.current = true;
        setIsRestoring(true);
        const res = await sessionClient.createTeacherSession(accessPin.trim());
        restoreInFlightRef.current = false;
        setIsRestoring(false);

        if (!res?.ok) {
            setError(getSocketErrorMessage(res) || kz.errors.createSession);
            return;
        }

        saveTeacherSession({
            code: res.code,
            teacherToken: res.teacherToken,
        });
        setCode(res.code);
        setTeacherToken(res.teacherToken);
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

    if (!isAuthorized) {
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
                            <Button onClick={handleTeacherAccess}>{kz.buttons.authorizeTeacher}</Button>
                        </div>
                    )}

                    <div className="mt-4 grid gap-3">
                        {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                    </div>
                </Panel>
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
                        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
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
