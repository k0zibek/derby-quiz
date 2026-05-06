import { useEffect, useMemo, useState } from "react";

import type {
    ConnectionState,
    PlayerState,
    TextQuestionDraft,
    ScreenState,
    SessionState,
    TeacherState,
} from "../../../shared/types";
import { sessionClient } from "../sessionClient";

type RoleState<T extends SessionState["role"]> = Extract<SessionState, { role: T }>;

export function useConnectionState() {
    const [connectionState, setConnectionState] = useState<ConnectionState>(sessionClient.getConnectionState());

    useEffect(() => {
        return sessionClient.subscribeToConnection((event) => {
            setConnectionState(event.state);
        });
    }, []);

    return {
        connectionState,
        isConnected: connectionState === "connected",
        serverUrl: sessionClient.serverUrl,
    };
}

export function useSessionState<T extends SessionState["role"]>(role: T) {
    const [session, setSession] = useState<RoleState<T> | null>(null);

    useEffect(() => {
        return sessionClient.subscribeToSessionState((state) => {
            if (state.role === role) {
                setSession(state as RoleState<T>);
            }
        });
    }, [role]);

    return [session, setSession] as const;
}

export function useTeacherActions(code: string, teacherToken: string) {
    return useMemo(
        () => ({
            startQuestion: () => sessionClient.startQuestion(code, teacherToken),
            showResults: () => sessionClient.showResults(code, teacherToken),
            nextQuestion: () => sessionClient.nextQuestion(code, teacherToken),
            resetGame: () => sessionClient.resetGame(code, teacherToken),
            addQuestion: (question: TextQuestionDraft) => sessionClient.addQuestion(code, teacherToken, question),
        }),
        [code, teacherToken]
    );
}

export function usePlayerActions(code: string, playerId: string, playerToken: string) {
    return useMemo(
        () => ({
            submitAnswer: (optionIndex: number) =>
                sessionClient.submitAnswer(code, playerId, playerToken, optionIndex),
        }),
        [code, playerId, playerToken]
    );
}

export type { PlayerState, ScreenState, TeacherState };
