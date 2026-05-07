import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

import { useAppPreferences } from "../appPreferencesContext";
import { AnswerTile, AppShell, Button, InlineNotice, LanguageToggle, Panel, Progress, StatusPill, ThemeToggle } from "../components/ui";
import { QuestionContent, QuestionOptionContent } from "../components/QuestionContent";
import { getConnectionMessage, getSocketErrorMessage } from "../i18n/helpers";
import { useConnectionState, usePlayerActions, useSessionState } from "../hooks/sessionHooks";
import { sessionClient } from "../sessionClient";
import { clearPlayerSession, loadPlayerSession, savePlayerSession } from "../sessionStorage";

const OPTION_TILE_CLASSES = [
    "border-sky-200 bg-sky-50 text-slate-950",
    "border-emerald-200 bg-emerald-50 text-slate-950",
    "border-amber-200 bg-amber-50 text-slate-950",
    "border-violet-200 bg-violet-50 text-slate-950",
    "border-rose-200 bg-rose-50 text-slate-950",
];

export default function JoinPage() {
    const { locale, setLocale, theme, setTheme, messages: copy } = useAppPreferences();
    const { code } = useParams();
    const gameCode = code ?? "";
    const [name, setName] = useState("");
    const [joined, setJoined] = useState(false);
    const [playerId, setPlayerId] = useState("");
    const [playerToken, setPlayerToken] = useState("");
    const [session, setSession] = useSessionState("player");
    const [joinLoading, setJoinLoading] = useState(false);
    const [answerFeedback, setAnswerFeedback] = useState("");
    const [sessionError, setSessionError] = useState("");
    const [isRejoining, setIsRejoining] = useState(true);
    const restoreInFlightRef = useRef(false);
    const { connectionState, serverUrl } = useConnectionState();
    const playerActions = usePlayerActions(gameCode, playerId, playerToken);

    useEffect(() => {
        async function restorePlayer() {
            const savedPlayerSession = loadPlayerSession(gameCode);
            if (!savedPlayerSession || joined || restoreInFlightRef.current) {
                setIsRejoining(false);
                return;
            }

            restoreInFlightRef.current = true;
            setIsRejoining(true);

            const res = await sessionClient.rejoinPlayer(
                gameCode,
                savedPlayerSession.playerId,
                savedPlayerSession.playerToken
            );
            restoreInFlightRef.current = false;

            if (res?.ok) {
                setJoined(true);
                setPlayerId(savedPlayerSession.playerId);
                setPlayerToken(savedPlayerSession.playerToken);
                setSession(res.state || null);
                setSessionError("");
                setIsRejoining(false);
                return;
            }

            if (
                res?.code === "SESSION_NOT_FOUND" ||
                res?.code === "PLAYER_NOT_FOUND" ||
                res?.code === "UNAUTHORIZED"
            ) {
                clearPlayerSession(gameCode);
                if (res?.code === "SESSION_NOT_FOUND") {
                    setSessionError(copy.errors.sessionNotFound);
                }
            }

            if (
                res?.code &&
                res.code !== "SOCKET_CONNECT_TIMEOUT" &&
                res.code !== "SOCKET_CONNECT_ERROR" &&
                res.code !== "ACK_TIMEOUT"
            ) {
                setSessionError(getSocketErrorMessage(res, copy));
            }

            setIsRejoining(false);
        }

        restorePlayer();
    }, [gameCode, joined, copy, setSession]);

    const player = session?.player;
    const alreadyAnswered = Boolean(player?.answeredCurrent);
    const connectionMessage = getConnectionMessage(connectionState, serverUrl, copy);
    const resultFeedback = session?.status === "result" && player?.lastAnswerCorrect === true
        ? copy.answerFeedback.correct
        : session?.status === "result" && player?.lastAnswerCorrect === false
          ? copy.answerFeedback.incorrect
          : answerFeedback;

    async function handleJoin() {
        if (joinLoading) return;

        if (!name.trim()) {
            setSessionError(copy.errors.enterName);
            return;
        }

        setJoinLoading(true);
        setSessionError("");

        const res = await sessionClient.joinPlayer(gameCode, name);
        setJoinLoading(false);

        if (!res?.ok) {
                setSessionError(res?.code === "SESSION_NOT_FOUND" ? copy.errors.sessionNotFound : getSocketErrorMessage(res, copy));
            return;
        }

        savePlayerSession(gameCode, {
            playerId: res.playerId,
            playerToken: res.playerToken,
        });
        setPlayerId(res.playerId);
        setPlayerToken(res.playerToken);
        setJoined(true);
    }

    async function submitAnswer(optionIndex: number) {
        if (!playerId || !playerToken || alreadyAnswered) return;

        const res = await playerActions.submitAnswer(optionIndex);
        if (!res?.ok) {
            if (
                res?.code === "UNAUTHORIZED" ||
                res?.code === "PLAYER_NOT_FOUND" ||
                res?.code === "SESSION_NOT_FOUND"
            ) {
                clearPlayerSession(gameCode);
                setJoined(false);
                setPlayerId("");
                setPlayerToken("");
                setSession(null);
            }
            setSessionError(getSocketErrorMessage(res, copy));
            return;
        }

        setSessionError("");
        setAnswerFeedback(res.isCorrect ? copy.answerFeedback.correct : copy.answerFeedback.incorrect);
    }

    if (!joined) {
        return (
            <AppShell variant="player" className="grid place-items-center p-5">
                <Panel className="w-full max-w-md p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusPill tone="blue">{copy.labels.code}: {gameCode}</StatusPill>
                        <div className="flex gap-2">
                            <LanguageToggle locale={locale} onChange={setLocale} />
                            <ThemeToggle theme={theme} onChange={setTheme} />
                        </div>
                    </div>
                    <h1 className="mt-5 text-4xl font-black leading-tight text-[var(--text)]">{copy.join.entryTitle}</h1>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{copy.join.subtitle}</p>

                    {isRejoining ? (
                        <div className="mt-5">
                            <InlineNotice>{copy.join.restore}</InlineNotice>
                        </div>
                    ) : (
                        <div className="mt-5 grid gap-3">
                            <input
                                className="h-14 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-4 text-lg font-bold text-[var(--text)] outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                placeholder={copy.join.placeholder}
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={24}
                            />
                            <Button className="min-h-14 text-base" onClick={handleJoin} disabled={joinLoading || isRejoining}>
                                {joinLoading ? copy.buttons.connecting : copy.buttons.connect}
                            </Button>
                        </div>
                    )}

                    <div className="mt-4 grid gap-3">
                        {sessionError ? <InlineNotice tone="danger">{sessionError}</InlineNotice> : null}
                        {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                    </div>
                </Panel>
            </AppShell>
        );
    }

    return (
        <AppShell variant="player">
            <div className="mx-auto grid w-full max-w-2xl gap-4">
                <header className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[var(--text-muted)]">{player?.name || copy.defaultPlayerName}</div>
                        <h1 className="text-3xl font-black leading-tight">
                            {session?.status === "finished" ? copy.join.thankYou : copy.appName}
                        </h1>
                    </div>
                    <StatusPill tone={session?.status === "question" ? "blue" : session?.status === "result" ? "amber" : "neutral"}>
                        {session ? copy.states[session.status].text : copy.states.lobby.text}
                    </StatusPill>
                </header>
                <div className="flex justify-end gap-2">
                    <LanguageToggle locale={locale} onChange={setLocale} />
                    <ThemeToggle theme={theme} onChange={setTheme} />
                </div>

                <Panel className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{copy.join.progressTitle}</div>
                            <div className="mt-1 text-2xl font-black">{player?.score ?? 0} {copy.labels.points}</div>
                        </div>
                        {alreadyAnswered ? <StatusPill tone="green">{copy.join.answerSent}</StatusPill> : null}
                    </div>
                    <Progress value={player?.progress ?? 0} color={player?.color || "#0284c7"} />
                </Panel>

                <AnimatePresence mode="wait">
                    <motion.section
                        key={session?.status ?? "empty"}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                    >
                        {session?.status === "lobby" ? (
                            <Panel>
                                <InlineNotice>{copy.join.lobby}</InlineNotice>
                            </Panel>
                        ) : null}

                        {session?.status === "question" && session?.currentQuestion ? (
                            <QuestionContent
                                question={session.currentQuestion}
                                badge={`${copy.labels.question} ${(session.currentQuestionIndex ?? 0) + 1} / ${session.totalQuestions}`}
                                questionImageAlt={copy.labels.questionImageAlt}
                            >
                                <div className="mt-4 grid gap-3">
                                    {session.currentQuestion.options.map((option, index) => (
                                        <AnswerTile
                                            key={`${option.label}-${index}`}
                                            colorClass={OPTION_TILE_CLASSES[index % OPTION_TILE_CLASSES.length] ?? OPTION_TILE_CLASSES[0]!}
                                            disabled={alreadyAnswered || connectionState !== "connected"}
                                            onClick={() => submitAnswer(index)}
                                        >
                                            <QuestionOptionContent option={option} index={index} imageAlt={copy.labels.optionImageAlt} />
                                        </AnswerTile>
                                    ))}
                                </div>
                            </QuestionContent>
                        ) : null}

                        {session?.status === "result" ? (
                            <Panel className="grid justify-items-center gap-4 py-10 text-center">
                                <StatusPill tone={resultFeedback === copy.answerFeedback.correct ? "green" : "red"}>
                                    {resultFeedback || copy.join.resultAccepted}
                                </StatusPill>
                                <h2 className="text-3xl font-black">{copy.join.resultTitle}</h2>
                                <p className="max-w-sm text-sm leading-6 text-[var(--text-muted)]">{copy.join.resultHint}</p>
                            </Panel>
                        ) : null}

                        {session?.status === "finished" ? (
                            <Panel className="grid justify-items-center gap-4 py-10 text-center">
                                <h2 className="text-3xl font-black">{copy.join.finishedTitle}</h2>
                                <div className="rounded-2xl bg-[var(--text)] px-5 py-3 text-2xl font-black text-[var(--background)]">
                                    {player?.score ?? 0} {copy.labels.points}
                                </div>
                                <p className="max-w-sm text-sm leading-6 text-[var(--text-muted)]">{copy.join.finishedHint}</p>
                            </Panel>
                        ) : null}
                    </motion.section>
                </AnimatePresence>

                <div className="grid gap-3">
                    {sessionError ? <InlineNotice tone="danger">{sessionError}</InlineNotice> : null}
                    {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                </div>
            </div>
        </AppShell>
    );
}
