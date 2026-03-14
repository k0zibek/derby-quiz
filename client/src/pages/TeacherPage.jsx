import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

import { QuestionContent, QuestionOptionContent } from "../components/QuestionContent";
import { getConnectionMessage, getStatusView, kz } from "../i18n/kz";
import { sessionClient } from "../sessionClient";

function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => { });
}

export default function TeacherPage() {
    const [code, setCode] = useState("");
    const [session, setSession] = useState(null);
    const [created, setCreated] = useState(false);
    const [error, setError] = useState("");
    const [connectionState, setConnectionState] = useState(sessionClient.getConnectionState());
    const creatingSessionRef = useRef(false);

    useEffect(() => {
        async function ensureSession() {
            if (created || creatingSessionRef.current) return;

            creatingSessionRef.current = true;
            const res = await sessionClient.createTeacherSession();
            creatingSessionRef.current = false;

            if (res?.ok) {
                setCode(res.code);
                setCreated(true);
                setError("");
                return;
            }

            if (res?.code === "SOCKET_CONNECT_TIMEOUT" || res?.code === "SOCKET_CONNECT_ERROR") {
                setError("");
                return;
            }

            setError(res?.error || kz.errors.createSession);
        }

        const unsubscribeState = sessionClient.subscribeToSessionState((state) => {
            setSession(state);
            if (state?.code) {
                setCode(state.code);
                setCreated(true);
                setError("");
            }
        });

        const unsubscribeConnection = sessionClient.subscribeToConnection((event) => {
            setConnectionState(event.state);

            if (event.type === "connect" && !created) {
                ensureSession();
            }
        });

        ensureSession();

        return () => {
            unsubscribeState();
            unsubscribeConnection();
        };
    }, [created]);

    const joinUrl = useMemo(() => {
        if (!code) return "";
        return `${window.location.origin}/join/${code}`;
    }, [code]);

    const screenUrl = useMemo(() => {
        if (!code) return "";
        return `${window.location.origin}/screen/${code}`;
    }, [code]);

    const statusView = getStatusView(session?.status);
    const currentQuestionNumber = (session?.currentQuestionIndex ?? 0) + 1;
    const totalQuestions = session?.totalQuestions ?? 0;
    const connectionMessage = getConnectionMessage(connectionState, sessionClient.serverUrl);

    async function handleAction(action) {
        setError("");
        const res = await action();
        if (!res?.ok) {
            setError(res?.error || kz.errors.operationFailed);
        }
    }

    return (
        <div className="page-shell">
            <div className="container">
                <section className="hero-card">
                    <div className="hero-row">
                        <div>
                            <div className="hero-kicker">{kz.teacher.kicker}</div>
                            <h1 className="hero-title">{kz.appName}</h1>
                            <p className="hero-subtitle">{kz.teacher.subtitle}</p>
                        </div>

                        <div>
                            <div className="badge">
                                {kz.labels.code}: {code || "..."}
                            </div>
                        </div>
                    </div>

                    <div className="stat-grid">
                        <div className="stat-card">
                            <div className="stat-label">{kz.labels.status}</div>
                            <div className="stat-value" style={{ fontSize: 20 }}>
                                {statusView.text}
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-label">{kz.labels.players}</div>
                            <div className="stat-value">{session?.totalPlayers ?? 0}</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-label">{kz.labels.answered}</div>
                            <div className="stat-value">{session?.answeredCount ?? 0}</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-label">{kz.labels.question}</div>
                            <div className="stat-value">
                                {totalQuestions ? `${currentQuestionNumber}/${totalQuestions}` : "0/0"}
                            </div>
                        </div>
                    </div>

                    {connectionMessage ? <div className="helper mt-16">{connectionMessage}</div> : null}
                    {error ? <div className="inline-error mt-16">{error}</div> : null}
                </section>

                <div className="grid grid-2">
                    <section className="card card-strong">
                        <div className="section-header">
                            <div>
                                <h2 className="card-title">{kz.teacher.joinTitle}</h2>
                                <p className="card-subtitle">{kz.teacher.joinSubtitle}</p>
                            </div>
                            <div className={statusView.className}>{statusView.text}</div>
                        </div>

                        <div className="qr-shell">
                            <QRCodeCanvas value={joinUrl || "https://example.com"} size={220} />
                        </div>

                        <div className="mt-16">
                            <div className="helper">{kz.labels.linkForPlayers}</div>
                            <div className="link-box mt-12">{joinUrl || "..."}</div>
                            <div className="inline-actions">
                                <button
                                    className="btn btn-neutral"
                                    onClick={() => copyText(joinUrl)}
                                    disabled={!joinUrl}
                                >
                                    {kz.buttons.copyLink}
                                </button>
                            </div>
                        </div>

                        <div className="mt-20">
                            <div className="helper">{kz.labels.linkForScreen}</div>
                            <div className="link-box mt-12">{screenUrl || "..."}</div>
                            <div className="inline-actions">
                                <button
                                    className="btn btn-neutral"
                                    onClick={() => copyText(screenUrl)}
                                    disabled={!screenUrl}
                                >
                                    {kz.buttons.copyScreen}
                                </button>
                                <a
                                    href={screenUrl || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`btn btn-primary ${screenUrl ? "" : "btn-disabled-link"}`}
                                    aria-disabled={!screenUrl}
                                    onClick={(event) => {
                                        if (!screenUrl) event.preventDefault();
                                    }}
                                >
                                    {kz.buttons.openScreen}
                                </a>
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <div className="section-header">
                            <div>
                                <h2 className="card-title">{kz.teacher.controlsTitle}</h2>
                                <p className="card-subtitle">{kz.teacher.controlsSubtitle}</p>
                            </div>
                        </div>

                        <div className="button-row">
                            <button
                                className="btn btn-success"
                                onClick={() => handleAction(() => sessionClient.startQuestion(code))}
                                disabled={!session?.canStart}
                            >
                                {kz.buttons.startQuestion}
                            </button>

                            <button
                                className="btn btn-warning"
                                onClick={() => handleAction(() => sessionClient.showResults(code))}
                                disabled={!session?.canShowResults}
                            >
                                {kz.buttons.showResults}
                            </button>

                            <button
                                className="btn btn-primary"
                                onClick={() => handleAction(() => sessionClient.nextQuestion(code))}
                                disabled={!session?.canGoNext}
                            >
                                {kz.buttons.nextQuestion}
                            </button>

                            <button
                                className="btn btn-danger"
                                onClick={() => handleAction(() => sessionClient.resetGame(code))}
                                disabled={!session?.canReset}
                            >
                                {kz.buttons.resetGame}
                            </button>
                        </div>

                        <div className="mt-24">
                            <div className="helper">{kz.labels.currentQuestion}</div>

                            <div className="mt-12">
                                {session?.currentQuestion ? (
                                    <QuestionContent
                                        question={session.currentQuestion}
                                        badge={`${kz.labels.question} ${currentQuestionNumber} / ${totalQuestions}`}
                                        titleTag="h3"
                                    >
                                        <div className="option-grid mt-16">
                                            {session.currentQuestion.options.map((option, index) => {
                                                const stat = session.optionStats?.find((item) => item.index === index);

                                                return (
                                                    <div key={`${option.label}-${index}`} className="answer-card">
                                                        <div className="answer-top">
                                                            <QuestionOptionContent option={option} index={index} />
                                                            <div
                                                                className={
                                                                    stat?.isCorrect ? "badge badge-success" : "badge badge-light"
                                                                }
                                                            >
                                                                {stat?.count ?? 0} {kz.labels.answerCount}
                                                            </div>
                                                        </div>

                                                        <div className="progress-track mt-12">
                                                            <div
                                                                className="progress-fill"
                                                                style={{
                                                                    width: `${session?.totalPlayers
                                                                        ? ((stat?.count ?? 0) / session.totalPlayers) * 100
                                                                        : 0
                                                                        }%`,
                                                                    background: stat?.isCorrect ? "#16a34a" : "#94a3b8",
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </QuestionContent>
                                ) : (
                                    <div className="empty-state">{kz.teacher.currentQuestionEmpty}</div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
