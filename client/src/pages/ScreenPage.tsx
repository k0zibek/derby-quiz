import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

import type { Player, ScreenState } from "../../../shared/types";
import { InlineNotice, Panel, Progress, StatusPill } from "../components/ui";
import { getRaceStatusText, kz } from "../i18n/kz";
import { sessionClient } from "../sessionClient";

type LaneModel = {
    player: Player;
    rank: number;
    left: number;
};

function Lane({ lane }: { lane: LaneModel }) {
    return (
        <div className="race-lane">
            <motion.div
                className="race-runner"
                animate={{ left: `${lane.left}%` }}
                transition={{ type: "spring", stiffness: 80, damping: 18 }}
            >
                <div
                    className="race-avatar"
                    style={{
                        background: `${lane.player.color}22`,
                        borderColor: lane.player.color,
                    }}
                >
                    {lane.rank}
                </div>
                <div className="race-name">{lane.player.name}</div>
            </motion.div>
        </div>
    );
}

function Podium({ players }: { players: Player[] }) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            {players.slice(0, 3).map((player, index) => (
                <motion.div
                    key={player.id}
                    className="rounded-2xl bg-white p-5 text-center shadow-sm"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                >
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-950 text-2xl font-black text-white">
                        {index + 1}
                    </div>
                    <div className="mt-4 truncate text-2xl font-black">{player.name}</div>
                    <div className="mt-1 text-lg font-bold text-slate-500">
                        {player.score} {kz.labels.points}
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

export default function ScreenPage() {
    const { code } = useParams();
    const gameCode = code ?? "";
    const [session, setSession] = useState<ScreenState | null>(null);
    const [error, setError] = useState("");
    const screenJoinedRef = useRef(false);
    const joiningScreenRef = useRef(false);

    useEffect(() => {
        async function connectScreen() {
            if (screenJoinedRef.current || joiningScreenRef.current) return;

            joiningScreenRef.current = true;
            const res = await sessionClient.joinScreen(gameCode);
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
            if (state.role !== "screen") return;
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
    }, [gameCode]);

    const players = useMemo(() => session?.players || [], [session?.players]);
    const lanes = useMemo(
        () =>
            players.map((player, index) => ({
                player,
                rank: index + 1,
                left: Math.max(7, Math.min(92, 7 + player.progress * 0.85)),
            })),
        [players]
    );

    return (
        <main className="min-h-screen overflow-hidden bg-sky-50 p-5 text-slate-950">
            <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl grid-rows-[auto_1fr_auto] gap-5">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <StatusPill tone={session?.status === "finished" ? "green" : session?.status === "result" ? "amber" : "blue"}>
                            {getRaceStatusText(session?.status)}
                        </StatusPill>
                        <h1 className="mt-3 text-5xl font-black leading-none md:text-7xl">{kz.screen.title}</h1>
                    </div>
                    <div className="grid justify-items-end gap-2 text-right">
                        <div className="font-mono text-4xl font-black tracking-[0.16em]">{gameCode}</div>
                        <div className="text-sm font-bold text-slate-500">
                            {session?.answeredCount ?? 0}/{session?.totalPlayers ?? 0} {kz.labels.answered.toLowerCase()}
                        </div>
                    </div>
                </header>

                {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

                <section className="race-track-clean">
                    <div className="race-finish" />
                    {lanes.length === 0 ? (
                        <div className="grid h-full place-items-center">
                            <InlineNotice>{kz.screen.empty}</InlineNotice>
                        </div>
                    ) : (
                        lanes.map((lane) => <Lane key={lane.player.id} lane={lane} />)
                    )}
                </section>

                <AnimatePresence mode="wait">
                    {session?.status === "finished" ? (
                        <motion.div
                            key="podium"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                        >
                            <Podium players={players} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="live"
                            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                        >
                            <Panel className="min-h-24">
                                <div className="text-sm font-bold text-slate-500">
                                    {kz.labels.question} {(session?.currentQuestionIndex ?? 0) + 1} / {session?.totalQuestions ?? 0}
                                </div>
                                <h2 className="mt-2 line-clamp-2 text-3xl font-black leading-tight">
                                    {session?.currentQuestion?.stem || getRaceStatusText(session?.status)}
                                </h2>
                            </Panel>
                            <Panel>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-bold text-slate-500">{kz.labels.topPlayers}</div>
                                    <StatusPill>{players.length}</StatusPill>
                                </div>
                                <div className="mt-3 grid gap-3">
                                    {players.slice(0, 3).map((player, index) => (
                                        <div key={player.id} className="grid grid-cols-[28px_minmax(0,1fr)_46px] items-center gap-3">
                                            <div className="text-xl font-black">{index + 1}</div>
                                            <div className="min-w-0">
                                                <div className="truncate text-lg font-black">{player.name}</div>
                                                <Progress value={player.progress} color={player.color} />
                                            </div>
                                            <div className="text-right text-lg font-black">{player.score}</div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
