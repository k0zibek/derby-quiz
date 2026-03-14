import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { sessionClient } from "../sessionClient";

const OPTION_COLORS = [
    { bg: "#eff6ff", border: "#bfdbfe" },
    { bg: "#ecfdf5", border: "#bbf7d0" },
    { bg: "#fff7ed", border: "#fed7aa" },
    { bg: "#faf5ff", border: "#e9d5ff" },
];

function getStatusLabel(status) {
    switch (status) {
        case "question":
            return { text: "Отвечай сейчас", className: "status-pill status-question" };
        case "result":
            return { text: "Результаты", className: "status-pill status-result" };
        case "finished":
            return { text: "Игра завершена", className: "status-pill status-finished" };
        default:
            return { text: "Ожидание старта", className: "status-pill status-lobby" };
    }
}

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
    const [screenState, setScreenState] = useState("connecting");
    const [sessionError, setSessionError] = useState("");
    const [isRejoining, setIsRejoining] = useState(true);

    useEffect(() => {
        const unsubscribeState = sessionClient.subscribeToSessionState((state) => {
            setSession(state);

            if (state?.player?.id) {
                setPlayerId(state.player.id);
                setJoined(true);
            }

            if (state?.player?.lastAnswerCorrect === true && state?.status === "result") {
                setAnswerFeedback("Правильно");
            } else if (state?.player?.lastAnswerCorrect === false && state?.status === "result") {
                setAnswerFeedback("Неправильно");
            } else if (state?.status === "question") {
                setAnswerFeedback("");
            }

            setSessionError("");
            setScreenState(sessionClient.socket.connected ? "connected" : "disconnected");
        });

        const unsubscribeConnection = sessionClient.subscribeToConnection(() => {
            setScreenState(sessionClient.socket.connected ? "connected" : "disconnected");
        });

        async function restorePlayer() {
            setIsRejoining(true);
            const savedPlayerId = localStorage.getItem(storageKey(code));

            if (!savedPlayerId) {
                setIsRejoining(false);
                setScreenState(sessionClient.socket.connected ? "connected" : "connecting");
                return;
            }

            const res = await sessionClient.rejoinPlayer(code, savedPlayerId);
            if (res?.ok) {
                setJoined(true);
                setPlayerId(savedPlayerId);
                setSession(res.state || null);
                setSessionError("");
            } else {
                localStorage.removeItem(storageKey(code));
                if (res?.code === "SESSION_NOT_FOUND") {
                    setSessionError("Сессия не найдена. Проверь код игры.");
                }
            }

            setIsRejoining(false);
        }

        restorePlayer();

        return () => {
            unsubscribeState();
            unsubscribeConnection();
        };
    }, [code]);

    const statusView = getStatusLabel(session?.status);
    const player = session?.player;
    const alreadyAnswered = Boolean(player?.answeredCurrent);
    const networkMessage =
        screenState === "disconnected"
            ? "Соединение потеряно. Пытаемся переподключиться."
            : screenState === "connecting"
                ? "Подключаемся к игре..."
                : "";

    async function handleJoin() {
        if (!name.trim()) {
            setSessionError("Введите имя");
            return;
        }

        setJoinLoading(true);
        setSessionError("");

        const res = await sessionClient.joinPlayer(code, name);
        setJoinLoading(false);

        if (!res?.ok) {
            if (res?.code === "SESSION_NOT_FOUND") {
                setSessionError("Сессия не найдена. Проверь код игры.");
            } else {
                setSessionError(res?.error || "Не удалось подключиться");
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
            setSessionError(res?.error || "Не удалось отправить ответ");
            return;
        }

        setSessionError("");
        setAnswerFeedback(res.isCorrect ? "Правильно" : "Неправильно");
    }

    const titleText = useMemo(() => {
        if (!joined) return "Вход в игру";
        if (session?.status === "finished") return "Спасибо за игру";
        return "Жайлау Quiz Race";
    }, [joined, session?.status]);

    if (!joined) {
        return (
            <div className="center-shell">
                <div className="center-card">
                    <div className="badge badge-purple">Код игры: {code}</div>

                    <h1 className="center-title mt-16">{titleText}</h1>
                    <p className="center-subtitle">
                        Введи имя и подключись к сессии. После этого жди вопрос от учителя.
                    </p>

                    {isRejoining ? (
                        <div className="empty-state">Восстанавливаем подключение после обновления страницы...</div>
                    ) : (
                        <>
                            <input
                                className="input"
                                placeholder="Например: Аружан"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={24}
                            />

                            <div className="button-row mt-16">
                                <button className="btn btn-primary" onClick={handleJoin} disabled={joinLoading}>
                                    {joinLoading ? "Подключение..." : "Подключиться"}
                                </button>
                            </div>
                        </>
                    )}

                    {sessionError ? <div className="inline-error mt-16">{sessionError}</div> : null}
                    {networkMessage ? <div className="helper mt-16">{networkMessage}</div> : null}

                    <div className="mt-20 helper">
                        Лучше использовать короткие имена, чтобы они красиво смотрелись на экране гонки.
                    </div>
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
                            <div className="hero-kicker">Player view</div>
                            <h1 className="hero-title">{titleText}</h1>
                            <p className="hero-subtitle">
                                {player?.name ? `${player.name}, ` : ""}
                                отвечай на вопросы с телефона и смотри, как твоя лошадь продвигается вперед.
                            </p>
                        </div>

                        <div className={statusView.className}>{statusView.text}</div>
                    </div>

                    {networkMessage ? <div className="helper mt-16">{networkMessage}</div> : null}
                    {sessionError ? <div className="inline-error mt-16">{sessionError}</div> : null}
                </section>

                <section className="card mt-24">
                    <div className="section-header">
                        <div>
                            <h2 className="card-title">Твой прогресс</h2>
                            <p className="card-subtitle">
                                Очки начисляются за правильные ответы.
                            </p>
                        </div>

                        <div className="badge badge-light">
                            {player?.score ?? 0} очков
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
                    {session?.status === "lobby" && (
                        <div className="empty-state">
                            Учитель еще не запустил вопрос. Подожди немного.
                        </div>
                    )}

                    {session?.status === "question" && session?.currentQuestion && (
                        <div className="question-box">
                            <div className="badge badge-light">
                                Вопрос {(session.currentQuestionIndex ?? 0) + 1} / {session.totalQuestions}
                            </div>

                            <h2 className="question-title mt-16">{session.currentQuestion.text}</h2>

                            <div className="option-grid">
                                {session.currentQuestion.options.map((option, index) => {
                                    const palette = OPTION_COLORS[index % OPTION_COLORS.length];

                                    return (
                                        <button
                                            key={index}
                                            className="option-btn"
                                            onClick={() => submitAnswer(index)}
                                            disabled={alreadyAnswered || screenState !== "connected"}
                                            style={{
                                                background: palette.bg,
                                                borderColor: palette.border,
                                                opacity: alreadyAnswered ? 0.7 : 1,
                                            }}
                                        >
                                            <span className="option-letter">
                                                {String.fromCharCode(65 + index)}
                                            </span>
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-16">
                                {alreadyAnswered ? (
                                    <div className="badge badge-success">Ответ отправлен</div>
                                ) : (
                                    <div className="helper">
                                        Выбери один вариант. Ответ можно отправить только один раз.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {session?.status === "result" && (
                        <div className="question-box">
                            <h2 className="question-title">Результат</h2>
                            <div
                                className={
                                    answerFeedback === "Правильно"
                                        ? "badge badge-success"
                                        : "badge badge-danger"
                                }
                                style={{ fontSize: 16, padding: "12px 16px" }}
                            >
                                {answerFeedback || "Ответ принят"}
                            </div>

                            <div className="mt-16 helper">
                                Смотри на общий экран — там видно положение всех лошадей.
                            </div>
                        </div>
                    )}

                    {session?.status === "finished" && (
                        <div className="question-box">
                            <h2 className="question-title">Игра завершена</h2>
                            <div className="badge badge-purple" style={{ fontSize: 16, padding: "12px 16px" }}>
                                Итог: {player?.score ?? 0} очков
                            </div>

                            <div className="mt-16 helper">
                                Учитель может перезапустить игру или начать новую сессию.
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
