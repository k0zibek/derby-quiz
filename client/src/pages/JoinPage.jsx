import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { QuestionContent, QuestionOptionContent } from "../components/QuestionContent";
import { getConnectionMessage, getSocketErrorMessage, getStatusView, kz } from "../i18n/kz";
import { sessionClient } from "../sessionClient";

const OPTION_COLORS = [
    { bg: "#eff6ff", border: "#bfdbfe" },
    { bg: "#ecfdf5", border: "#bbf7d0" },
    { bg: "#fff7ed", border: "#fed7aa" },
    { bg: "#faf5ff", border: "#e9d5ff" },
    { bg: "#fef2f2", border: "#fecaca" },
];

function storageKey(code) {
    return `horse-quiz-player:${code}`;
}

export default function JoinPage() {
    const { code } = useParams();
    const [name, setName] = useState("");
    const [joined, setJoined] = useState(false);
    const [playerId, setPlayerId] = useState("");
    const [session, setSession] = useState(null);
    const [joinLoading, setJoinLoading] = useState(false);
    const [answerFeedback, setAnswerFeedback] = useState("");
    const [connectionState, setConnectionState] = useState(sessionClient.getConnectionState());
    const [sessionError, setSessionError] = useState("");
    const [isRejoining, setIsRejoining] = useState(true);
    const restoreInFlightRef = useRef(false);

    useEffect(() => {
        async function restorePlayer() {
            const savedPlayerId = localStorage.getItem(storageKey(code));
            if (!savedPlayerId || joined || restoreInFlightRef.current) {
                setIsRejoining(false);
                return;
            }

            restoreInFlightRef.current = true;
            setIsRejoining(true);

            const res = await sessionClient.rejoinPlayer(code, savedPlayerId);
            restoreInFlightRef.current = false;

            if (res?.ok) {
                setJoined(true);
                setPlayerId(savedPlayerId);
                setSession(res.state || null);
                setSessionError("");
                setIsRejoining(false);
                return;
            }

            if (res?.code === "SESSION_NOT_FOUND" || res?.code === "PLAYER_NOT_FOUND") {
                localStorage.removeItem(storageKey(code));
                if (res?.code === "SESSION_NOT_FOUND") {
                    setSessionError(kz.errors.sessionNotFound);
                }
            }

            if (
                res?.code &&
                res.code !== "SOCKET_CONNECT_TIMEOUT" &&
                res.code !== "SOCKET_CONNECT_ERROR" &&
                res.code !== "ACK_TIMEOUT"
            ) {
                setSessionError(getSocketErrorMessage(res));
            }

            setIsRejoining(false);
        }

        const unsubscribeState = sessionClient.subscribeToSessionState((state) => {
            setSession(state);

            if (state?.player?.id) {
                setPlayerId(state.player.id);
                setJoined(true);
            }

            if (state?.player?.lastAnswerCorrect === true && state?.status === "result") {
                setAnswerFeedback(kz.answerFeedback.correct);
            } else if (state?.player?.lastAnswerCorrect === false && state?.status === "result") {
                setAnswerFeedback(kz.answerFeedback.incorrect);
            } else if (state?.status === "question") {
                setAnswerFeedback("");
            }

            setSessionError("");
            setConnectionState(sessionClient.getConnectionState());
        });

        const unsubscribeConnection = sessionClient.subscribeToConnection((event) => {
            setConnectionState(event.state);

            if (event.type === "connect") {
                restorePlayer();
            }
        });

        restorePlayer();

        return () => {
            unsubscribeState();
            unsubscribeConnection();
        };
    }, [code, joined]);

    const statusView = getStatusView(session?.status);
    const player = session?.player;
    const alreadyAnswered = Boolean(player?.answeredCurrent);
    const connectionMessage = getConnectionMessage(connectionState, sessionClient.serverUrl);

    async function handleJoin() {
        if (joinLoading) return;

        if (!name.trim()) {
            setSessionError(kz.errors.enterName);
            return;
        }

        setJoinLoading(true);
        setSessionError("");

        const res = await sessionClient.joinPlayer(code, name);
        setJoinLoading(false);

        if (!res?.ok) {
            if (res?.code === "SESSION_NOT_FOUND") {
                setSessionError(kz.errors.sessionNotFound);
            } else {
                setSessionError(getSocketErrorMessage(res));
            }
            return;
        }

        localStorage.setItem(storageKey(code), res.playerId);
        setPlayerId(res.playerId);
        setJoined(true);
    }

    async function submitAnswer(optionIndex) {
        if (!playerId || alreadyAnswered) return;

        const res = await sessionClient.submitAnswer(code, playerId, optionIndex);
        if (!res?.ok) {
            setSessionError(getSocketErrorMessage(res));
            return;
        }

        setSessionError("");
        setAnswerFeedback(res.isCorrect ? kz.answerFeedback.correct : kz.answerFeedback.incorrect);
    }

    const titleText = useMemo(() => {
        if (!joined) return kz.join.entryTitle;
        if (session?.status === "finished") return kz.join.thankYou;
        return kz.appName;
    }, [joined, session?.status]);

    if (!joined) {
        return (
            <div className="center-shell">
                <div className="center-card">
                    <div className="badge badge-purple">
                        {kz.labels.code}: {code}
                    </div>

                    <h1 className="center-title mt-16">{titleText}</h1>
                    <p className="center-subtitle">{kz.join.subtitle}</p>

                    {isRejoining ? (
                        <div className="empty-state">{kz.join.restore}</div>
                    ) : (
                        <>
                            <input
                                className="input"
                                placeholder={kz.join.placeholder}
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={24}
                            />

                            <div className="button-row mt-16">
                                <button
                                    className="btn btn-primary"
                                    onClick={handleJoin}
                                    disabled={joinLoading || isRejoining}
                                >
                                    {joinLoading ? kz.buttons.connecting : kz.buttons.connect}
                                </button>
                            </div>
                        </>
                    )}

                    {sessionError ? <div className="inline-error mt-16">{sessionError}</div> : null}
                    {connectionMessage ? <div className="helper mt-16">{connectionMessage}</div> : null}

                    <div className="mt-20 helper">{kz.join.shortNames}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell">
            <div className="container" style={{ maxWidth: 760 }}>
                <section className="hero-card">
                    <div className="hero-row">
                        <div>
                            <div className="hero-kicker">Ойыншы экраны</div>
                            <h1 className="hero-title">{titleText}</h1>
                            <p className="hero-subtitle">
                                {player?.name ? `${player.name}, ` : ""}
                                сұрақтарға телефоннан жауап беріп, тұлпарыңның жарыста қалай алға шыққанын бақыла.
                            </p>
                        </div>

                        <div className={statusView.className}>{statusView.text}</div>
                    </div>

                    {connectionMessage ? <div className="helper mt-16">{connectionMessage}</div> : null}
                    {sessionError ? <div className="inline-error mt-16">{sessionError}</div> : null}
                </section>

                <section className="card mt-24">
                    <div className="section-header">
                        <div>
                            <h2 className="card-title">{kz.join.progressTitle}</h2>
                            <p className="card-subtitle">{kz.join.progressSubtitle}</p>
                        </div>

                        <div className="badge badge-light">
                            {player?.score ?? 0} {kz.labels.points}
                        </div>
                    </div>

                    <div className="progress-track">
                        <div
                            className="progress-fill"
                            style={{
                                width: `${player?.progress ?? 0}%`,
                                background: player?.color || "#2563eb",
                            }}
                        />
                    </div>
                </section>

                <section className="card mt-24">
                    {session?.status === "lobby" && <div className="empty-state">{kz.join.lobby}</div>}

                    {session?.status === "question" && session?.currentQuestion && (
                        <QuestionContent
                            question={session.currentQuestion}
                            badge={`${kz.labels.question} ${(session.currentQuestionIndex ?? 0) + 1} / ${session.totalQuestions}`}
                        >
                            <div className="option-grid mt-16">
                                {session.currentQuestion.options.map((option, index) => {
                                    const palette = OPTION_COLORS[index % OPTION_COLORS.length];

                                    return (
                                        <button
                                            key={`${option.label}-${index}`}
                                            className="option-btn"
                                            onClick={() => submitAnswer(index)}
                                            disabled={alreadyAnswered || connectionState !== "connected"}
                                            style={{
                                                background: palette.bg,
                                                borderColor: palette.border,
                                                opacity: alreadyAnswered ? 0.7 : 1,
                                            }}
                                        >
                                            <QuestionOptionContent option={option} index={index} />
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-16">
                                {alreadyAnswered ? (
                                    <div className="badge badge-success">{kz.join.answerSent}</div>
                                ) : (
                                    <div className="helper">{kz.join.answerHint}</div>
                                )}
                            </div>
                        </QuestionContent>
                    )}

                    {session?.status === "result" && (
                        <div className="question-box">
                            <h2 className="question-title">{kz.join.resultTitle}</h2>
                            <div
                                className={
                                    answerFeedback === kz.answerFeedback.correct
                                        ? "badge badge-success"
                                        : "badge badge-danger"
                                }
                                style={{ fontSize: 16, padding: "12px 16px" }}
                            >
                                {answerFeedback || kz.join.resultAccepted}
                            </div>

                            <div className="mt-16 helper">{kz.join.resultHint}</div>
                        </div>
                    )}

                    {session?.status === "finished" && (
                        <div className="question-box">
                            <h2 className="question-title">{kz.join.finishedTitle}</h2>
                            <div className="badge badge-purple" style={{ fontSize: 16, padding: "12px 16px" }}>
                                {player?.score ?? 0} {kz.labels.points}
                            </div>

                            <div className="mt-16 helper">{kz.join.finishedHint}</div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
