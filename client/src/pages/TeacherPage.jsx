import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { socket } from "../socket";

function getStatusLabel(status) {
    switch (status) {
        case "question":
            return { text: "Идет вопрос", className: "status-pill status-question" };
        case "result":
            return { text: "Показ результатов", className: "status-pill status-result" };
        case "finished":
            return { text: "Игра завершена", className: "status-pill status-finished" };
        default:
            return { text: "Лобби", className: "status-pill status-lobby" };
    }
}

function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => { });
}

export default function TeacherPage() {
    const [code, setCode] = useState("");
    const [session, setSession] = useState(null);
    const [created, setCreated] = useState(false);

    useEffect(() => {
        const handleState = (state) => setSession(state);

        socket.on("session:state", handleState);

        if (!created) {
            socket.emit("teacher:createSession", {}, (res) => {
                if (res?.ok) {
                    setCode(res.code);
                    setCreated(true);
                } else {
                    alert(res?.error || "Не удалось создать сессию");
                }
            });
        }

        return () => {
            socket.off("session:state", handleState);
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

    const players = session?.players || [];
    const statusView = getStatusLabel(session?.status);

    const handleStartQuestion = () => {
        socket.emit("teacher:startQuestion", { code }, (res) => {
            if (!res?.ok) alert(res?.error || "Не удалось запустить вопрос");
        });
    };

    const handleShowResults = () => {
        socket.emit("teacher:showResults", { code }, (res) => {
            if (!res?.ok) alert(res?.error || "Не удалось показать результаты");
        });
    };

    const handleNextQuestion = () => {
        socket.emit("teacher:nextQuestion", { code }, (res) => {
            if (!res?.ok) alert(res?.error || "Не удалось перейти к следующему вопросу");
        });
    };

    const handleReset = () => {
        socket.emit("teacher:resetGame", { code }, (res) => {
            if (!res?.ok) alert(res?.error || "Не удалось сбросить игру");
        });
    };

    const currentQuestionNumber = (session?.currentQuestionIndex ?? 0) + 1;
    const totalQuestions = session?.totalQuestions ?? 0;

    return (
        <div className="page-shell">
            <div className="container">
                <section className="hero-card">
                    <div className="hero-row">
                        <div>
                            <div className="hero-kicker">Teacher dashboard</div>
                            <h1 className="hero-title">Жайлау Quiz Race</h1>
                            <p className="hero-subtitle">
                                Ученики заходят по QR-коду, отвечают с телефона, а ты видишь
                                прогресс всей группы и гонку лошадей в реальном времени.
                            </p>
                        </div>

                        <div>
                            <div className="badge">Код игры: {code || "..."}</div>
                        </div>
                    </div>

                    <div className="stat-grid">
                        <div className="stat-card">
                            <div className="stat-label">Статус</div>
                            <div className="stat-value" style={{ fontSize: 20 }}>
                                {session?.status || "lobby"}
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-label">Игроков</div>
                            <div className="stat-value">{session?.totalPlayers ?? 0}</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-label">Ответили</div>
                            <div className="stat-value">{session?.answeredCount ?? 0}</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-label">Вопрос</div>
                            <div className="stat-value">
                                {totalQuestions ? `${currentQuestionNumber}/${totalQuestions}` : "0/0"}
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-2">
                    <section className="card card-strong">
                        <div className="section-header">
                            <div>
                                <h2 className="card-title">Подключение учеников</h2>
                                <p className="card-subtitle">
                                    Покажи QR-код на проекторе или отправь ссылку вручную.
                                </p>
                            </div>
                            <div className={statusView.className}>{statusView.text}</div>
                        </div>

                        <div className="qr-shell">
                            <QRCodeCanvas value={joinUrl || "https://example.com"} size={220} />
                        </div>

                        <div className="mt-16">
                            <div className="helper">Ссылка для входа учеников</div>
                            <div className="link-box mt-12">{joinUrl || "Создается..."}</div>
                            <div className="inline-actions">
                                <button className="btn btn-neutral" onClick={() => copyText(joinUrl)}>
                                    Скопировать ссылку
                                </button>
                            </div>
                        </div>

                        <div className="mt-20">
                            <div className="helper">Ссылка для большого экрана гонки</div>
                            <div className="link-box mt-12">{screenUrl || "Создается..."}</div>
                            <div className="inline-actions">
                                <button className="btn btn-neutral" onClick={() => copyText(screenUrl)}>
                                    Скопировать экран
                                </button>
                                <a
                                    href={screenUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-primary"
                                >
                                    Открыть экран гонки
                                </a>
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <div className="section-header">
                            <div>
                                <h2 className="card-title">Управление игрой</h2>
                                <p className="card-subtitle">
                                    Базовый сценарий: запустить вопрос → показать результаты →
                                    следующий вопрос.
                                </p>
                            </div>
                        </div>

                        <div className="button-row">
                            <button className="btn btn-success" onClick={handleStartQuestion}>
                                Запустить вопрос
                            </button>

                            <button className="btn btn-warning" onClick={handleShowResults}>
                                Показать результаты
                            </button>

                            <button className="btn btn-primary" onClick={handleNextQuestion}>
                                Следующий вопрос
                            </button>

                            <button className="btn btn-danger" onClick={handleReset}>
                                Сбросить игру
                            </button>
                        </div>

                        <div className="mt-24">
                            <div className="helper">Текущий вопрос</div>

                            <div className="question-box mt-12">
                                {session?.currentQuestion ? (
                                    <>
                                        <h3 className="question-title">{session.currentQuestion.text}</h3>

                                        <div className="option-grid">
                                            {session.currentQuestion.options.map((option, index) => {
                                                const stat = session.optionStats?.find((item) => item.index === index);

                                                return (
                                                    <div key={index} className="answer-card">
                                                        <div className="answer-top">
                                                            <div className="answer-title">
                                                                {String.fromCharCode(65 + index)}. {option}
                                                            </div>
                                                            <div
                                                                className={
                                                                    stat?.isCorrect ? "badge badge-success" : "badge badge-light"
                                                                }
                                                            >
                                                                {stat?.count ?? 0} ответов
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
                                    </>
                                ) : (
                                    <div className="empty-state">
                                        Вопрос пока не активен. Запусти игру, когда все подключатся.
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>

                <section className="card mt-24">
                    <div className="section-header">
                        <div>
                            <h2 className="card-title">Игроки</h2>
                            <p className="card-subtitle">
                                Список обновляется автоматически. Серый статус — игрок отключился.
                            </p>
                        </div>
                        <div className="badge badge-purple">
                            Всего: {players.length} / 50
                        </div>
                    </div>

                    {players.length === 0 ? (
                        <div className="empty-state">
                            Пока никого нет. Пусть ученики отсканируют QR-код и войдут в игру.
                        </div>
                    ) : (
                        <div className="player-list">
                            {players.map((player, index) => (
                                <div
                                    key={player.id}
                                    className="player-card"
                                    style={{
                                        opacity: player.connected ? 1 : 0.72,
                                    }}
                                >
                                    <div className="player-row">
                                        <div className="player-left">
                                            <div className="player-rank">{index + 1}</div>
                                            <div
                                                className="player-dot"
                                                style={{ background: player.color }}
                                            />
                                            <div>
                                                <div className="player-name">{player.name}</div>
                                                <div className="player-meta">
                                                    {player.connected ? "в сети" : "отключен"} ·{" "}
                                                    {player.answeredCurrent ? "ответил" : "ждет"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="badge badge-light">
                                            {player.score} очков
                                        </div>
                                    </div>

                                    <div className="progress-track">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${player.progress}%`,
                                                background: player.color,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
