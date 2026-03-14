import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { sessionClient } from "../sessionClient";

function getStatusText(status) {
    switch (status) {
        case "question":
            return "Идет вопрос";
        case "result":
            return "Результаты вопроса";
        case "finished":
            return "Финал";
        default:
            return "Сбор игроков";
    }
}

function PodiumCard({ player, rank, emoji, ringColor }) {
    if (!player) {
        return (
            <div className="podium-card">
                <div className="podium-rank" style={{ background: "#f3f4f6", color: "#6b7280" }}>
                    {rank}
                </div>
                <div className="helper">Пока пусто</div>
            </div>
        );
    }

    return (
        <div className="podium-card">
            <div
                className="podium-rank"
                style={{ background: ringColor.background, color: ringColor.color }}
            >
                {rank}
            </div>

            <div
                style={{
                    width: 78,
                    height: 78,
                    margin: "0 auto 12px",
                    borderRadius: 24,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 40,
                    background: `${player.color}22`,
                    border: `4px solid ${player.color}`,
                }}
            >
                {emoji}
            </div>

            <div style={{ fontWeight: 800, fontSize: 18 }}>{player.name}</div>
            <div className="helper">{player.score} очков</div>
        </div>
    );
}

function Lane({ lane }) {
    return (
        <div className="lane">
            <div className="horse-runner" style={{ left: `${lane.left}%` }}>
                <div
                    className="horse-avatar"
                    style={{
                        background: `${lane.player.color}22`,
                        borderColor: lane.player.color,
                    }}
                >
                    🐎
                </div>

                <div className="horse-label">
                    <div className="horse-name">
                        #{lane.rank} {lane.player.name}
                    </div>
                    <div className="horse-meta">
                        {lane.player.score} очков · прогресс {lane.player.progress}%
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ScreenPage() {
    const { code } = useParams();
    const [session, setSession] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const unsubscribe = sessionClient.subscribeToSessionState((state) => {
            setSession(state);
            setError("");
        });

        async function connectScreen() {
            const res = await sessionClient.joinScreen(code);
            if (!res?.ok) {
                setError(res?.error || "Не удалось подключить экран");
            }
        }

        connectScreen();
        return unsubscribe;
    }, [code]);

    const players = useMemo(() => session?.players || [], [session?.players]);
    const topThree = players.slice(0, 3);
    const lanes = useMemo(() => {
        return players.map((player, index) => ({
            player,
            rank: index + 1,
            left: Math.max(5, Math.min(92, 5 + player.progress * 0.87)),
        }));
    }, [players]);

    return (
        <div className="race-page">
            <div className="race-shell">
                <section className="race-header">
                    <div>
                        <div className="badge badge-purple">Экран гонки · код {code}</div>
                        <h1 className="race-title">Жайлау жарысы</h1>
                        <p className="race-subtitle">
                            {getStatusText(session?.status)} · ответили {session?.answeredCount ?? 0} из{" "}
                            {session?.totalPlayers ?? 0}
                        </p>
                    </div>

                    <div className="button-row">
                        <div className="badge badge-light">
                            Вопрос {(session?.currentQuestionIndex ?? 0) + 1} / {session?.totalQuestions ?? 0}
                        </div>
                        <div
                            className={
                                session?.status === "finished"
                                    ? "badge badge-success"
                                    : session?.status === "result"
                                        ? "badge badge-warning"
                                        : "badge badge-light"
                            }
                        >
                            {getStatusText(session?.status)}
                        </div>
                    </div>
                </section>

                {error ? <div className="inline-error mt-16">{error}</div> : null}

                {session?.status === "finished" && (
                    <section className="card mt-20">
                        <div className="section-header">
                            <div>
                                <h2 className="card-title">Победители</h2>
                                <p className="card-subtitle">Топ игроков этой сессии.</p>
                            </div>
                        </div>

                        <div className="top3-grid">
                            <PodiumCard
                                player={topThree[0]}
                                rank={1}
                                emoji="🏆"
                                ringColor={{ background: "#fef3c7", color: "#92400e" }}
                            />
                            <PodiumCard
                                player={topThree[1]}
                                rank={2}
                                emoji="🥈"
                                ringColor={{ background: "#e5e7eb", color: "#374151" }}
                            />
                            <PodiumCard
                                player={topThree[2]}
                                rank={3}
                                emoji="🥉"
                                ringColor={{ background: "#ffedd5", color: "#9a3412" }}
                            />
                        </div>
                    </section>
                )}

                <section className="race-track mt-20">
                    <div className="track-inner">
                        <div className="finish-line" />

                        {lanes.length === 0 ? (
                            <div className="empty-state" style={{ margin: 12 }}>
                                Игроки еще не подключились. Покажите QR-код ученикам.
                            </div>
                        ) : (
                            lanes.map((lane) => (
                                <Lane key={lane.player.id} lane={lane} />
                            ))
                        )}
                    </div>
                </section>

                {session?.currentQuestion && session?.status !== "finished" && (
                    <section className="card mt-20">
                        <div className="section-header">
                            <div>
                                <h2 className="card-title">Текущий вопрос</h2>
                                <p className="card-subtitle">
                                    Ученики отвечают с телефона. Гонка обновляется автоматически.
                                </p>
                            </div>
                        </div>

                        <div className="question-box">
                            <h3 className="question-title">{session.currentQuestion.text}</h3>

                            <div className="option-grid">
                                {session.currentQuestion.options.map((option, index) => (
                                    <div key={index} className="answer-card">
                                        <div className="answer-top">
                                            <div className="answer-title">
                                                {String.fromCharCode(65 + index)}. {option}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
