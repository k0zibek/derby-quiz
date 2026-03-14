import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { QuestionContent, QuestionOptionContent } from "../components/QuestionContent";
import { getRaceStatusText, kz } from "../i18n/kz";
import { sessionClient } from "../sessionClient";

function PodiumCard({ player, rank, emoji, ringColor }) {
    if (!player) {
        return (
            <div className="podium-card">
                <div className="podium-rank" style={{ background: "#f3f4f6", color: "#6b7280" }}>
                    {rank}
                </div>
                <div className="helper">Әзірге бос</div>
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
            <div className="helper">
                {player.score} {kz.labels.points}
            </div>
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
                        {lane.player.score} {kz.labels.points} · {kz.labels.progress.toLowerCase()} {lane.player.progress}%
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
    const screenJoinedRef = useRef(false);
    const joiningScreenRef = useRef(false);

    useEffect(() => {
        async function connectScreen() {
            if (screenJoinedRef.current || joiningScreenRef.current) return;

            joiningScreenRef.current = true;
            const res = await sessionClient.joinScreen(code);
            joiningScreenRef.current = false;

            if (!res?.ok) {
                if (res?.code === "SOCKET_CONNECT_TIMEOUT" || res?.code === "SOCKET_CONNECT_ERROR") {
                    setError("");
                    return;
                }

                setError(res?.error || kz.errors.connectScreen);
                return;
            }

            screenJoinedRef.current = true;
            setError("");
        }

        const unsubscribeState = sessionClient.subscribeToSessionState((state) => {
            setSession(state);
            screenJoinedRef.current = true;
            setError("");
        });

        const unsubscribeConnection = sessionClient.subscribeToConnection((event) => {
            if (event.type === "connect" && !screenJoinedRef.current) {
                connectScreen();
            }
        });

        connectScreen();

        return () => {
            unsubscribeState();
            unsubscribeConnection();
        };
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
                        <div className="badge badge-purple">
                            {kz.labels.raceScreen} · {kz.labels.code.toLowerCase()} {code}
                        </div>
                        <h1 className="race-title">{kz.screen.title}</h1>
                        <p className="race-subtitle">
                            {getRaceStatusText(session?.status)} · {kz.labels.answered.toLowerCase()} {session?.answeredCount ?? 0} /{" "}
                            {session?.totalPlayers ?? 0}
                        </p>
                    </div>

                    <div className="button-row">
                        <div className="badge badge-light">
                            {kz.labels.question} {(session?.currentQuestionIndex ?? 0) + 1} / {session?.totalQuestions ?? 0}
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
                            {getRaceStatusText(session?.status)}
                        </div>
                    </div>
                </section>

                {error ? <div className="inline-error mt-16">{error}</div> : null}

                {session?.status === "finished" && (
                    <section className="card mt-20">
                        <div className="section-header">
                            <div>
                                <h2 className="card-title">{kz.labels.winners}</h2>
                                <p className="card-subtitle">{kz.labels.topPlayers}</p>
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
                                {kz.screen.empty}
                            </div>
                        ) : (
                            lanes.map((lane) => <Lane key={lane.player.id} lane={lane} />)
                        )}
                    </div>
                </section>

                {session?.currentQuestion && session?.status !== "finished" && (
                    <section className="card mt-20">
                        <div className="section-header">
                            <div>
                                <h2 className="card-title">{kz.labels.currentQuestion}</h2>
                                <p className="card-subtitle">{kz.screen.currentQuestionSubtitle}</p>
                            </div>
                        </div>

                        <QuestionContent
                            question={session.currentQuestion}
                            badge={`${kz.labels.question} ${(session?.currentQuestionIndex ?? 0) + 1} / ${session?.totalQuestions ?? 0}`}
                            titleTag="h3"
                        >
                            <div className="option-grid mt-16">
                                {session.currentQuestion.options.map((option, index) => (
                                    <div key={`${option.label}-${index}`} className="answer-card">
                                        <QuestionOptionContent option={option} index={index} />
                                    </div>
                                ))}
                            </div>
                        </QuestionContent>
                    </section>
                )}
            </div>
        </div>
    );
}
