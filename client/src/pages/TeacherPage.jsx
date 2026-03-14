import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

import { QuestionContent, QuestionOptionContent } from "../components/QuestionContent";
import { getConnectionMessage, getSocketErrorMessage, getStatusView, kz } from "../i18n/kz";
import { sessionClient } from "../sessionClient";
import { clearTeacherSession, loadTeacherSession, saveTeacherSession } from "../sessionStorage";

function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => { });
}

export default function TeacherPage() {
    const [accessPin, setAccessPin] = useState("");
    const [code, setCode] = useState("");
    const [teacherToken, setTeacherToken] = useState("");
    const [session, setSession] = useState(null);
    const [isRestoring, setIsRestoring] = useState(() => Boolean(loadTeacherSession()));
    const [error, setError] = useState("");
    const [connectionState, setConnectionState] = useState(sessionClient.getConnectionState());
    const restoreInFlightRef = useRef(false);

    useEffect(() => {
        let isMounted = true;

        async function restoreSession() {
            const storedSession = loadTeacherSession();
            if (!storedSession || restoreInFlightRef.current) {
                if (isMounted) {
                    setIsRestoring(false);
                }
                return;
            }

            restoreInFlightRef.current = true;
            if (isMounted) {
                setIsRestoring(true);
            }

            const response = await sessionClient.joinTeacherSession(storedSession.code, storedSession.teacherToken);
            restoreInFlightRef.current = false;

            if (!isMounted) return;

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
                setIsRestoring(false);
                return;
            }

            if (
                response?.code !== "SOCKET_CONNECT_TIMEOUT" &&
                response?.code !== "SOCKET_CONNECT_ERROR" &&
                response?.code !== "ACK_TIMEOUT"
            ) {
                setError(getSocketErrorMessage(response) || kz.errors.createSession);
            }

            setIsRestoring(false);
        }

        const unsubscribeState = sessionClient.subscribeToSessionState((state) => {
            setSession(state);
            if (state?.code) {
                setCode(state.code);
                setError("");
            }
        });

        const unsubscribeConnection = sessionClient.subscribeToConnection((event) => {
            setConnectionState(event.state);

            if (event.type === "connect") {
                restoreSession();
            }
        });

        restoreSession();

        return () => {
            isMounted = false;
            unsubscribeState();
            unsubscribeConnection();
        };
    }, []);

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
    const isAuthorized = Boolean(code && teacherToken);

    async function handleAction(action) {
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
        setError("");
    }

    if (!isAuthorized) {
        return (
            <div className="center-shell">
                <div className="center-card">
                    <div className="badge badge-purple">{kz.teacher.kicker}</div>
                    <h1 className="center-title mt-16">
                        {isRestoring ? kz.teacher.restoreTitle : kz.teacher.accessTitle}
                    </h1>
                    <p className="center-subtitle">
                        {isRestoring ? kz.teacher.restoreSubtitle : kz.teacher.accessSubtitle}
                    </p>

                    {isRestoring ? (
                        <div className="empty-state">{kz.teacher.restoreHint}</div>
                    ) : (
                        <>
                            <input
                                className="input"
                                placeholder={kz.teacher.accessPlaceholder}
                                value={accessPin}
                                onChange={(event) => setAccessPin(event.target.value)}
                                maxLength={32}
                            />

                            <div className="button-row mt-16">
                                <button className="btn btn-primary" onClick={handleTeacherAccess}>
                                    {kz.buttons.authorizeTeacher}
                                </button>
                            </div>
                        </>
                    )}

                    {connectionMessage ? <div className="helper mt-16">{connectionMessage}</div> : null}
                    {error ? <div className="inline-error mt-16">{error}</div> : null}
                    <div className="mt-20 helper">{kz.teacher.accessHint}</div>
                </div>
            </div>
        );
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
                                onClick={() => handleAction(() => sessionClient.startQuestion(code, teacherToken))}
                                disabled={!session?.canStart}
                            >
                                {kz.buttons.startQuestion}
                            </button>

                            <button
                                className="btn btn-warning"
                                onClick={() => handleAction(() => sessionClient.showResults(code, teacherToken))}
                                disabled={!session?.canShowResults}
                            >
                                {kz.buttons.showResults}
                            </button>

                            <button
                                className="btn btn-primary"
                                onClick={() => handleAction(() => sessionClient.nextQuestion(code, teacherToken))}
                                disabled={!session?.canGoNext}
                            >
                                {kz.buttons.nextQuestion}
                            </button>

                            <button
                                className="btn btn-danger"
                                onClick={() => handleAction(() => sessionClient.resetGame(code, teacherToken))}
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
