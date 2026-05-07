import { useCallback, useEffect, useRef, useState } from "react";

import type { AckResponse, ConnectionState } from "../../../../shared/types";
import { getSocketErrorMessage } from "../../i18n/helpers";
import type { AppMessages } from "../../i18n/types";
import { useSessionState } from "../../hooks/sessionHooks";
import { sessionClient } from "../../sessionClient";
import { clearTeacherSession, loadTeacherSession } from "../../sessionStorage";

export function useTeacherSessionController(copy: AppMessages, connectionState: ConnectionState) {
    const [code, setCode] = useState("");
    const [teacherToken, setTeacherToken] = useState("");
    const [session, setSession] = useSessionState("teacher");
    const [isRestoring, setIsRestoring] = useState(() => Boolean(loadTeacherSession()));
    const [error, setError] = useState("");
    const restoreInFlightRef = useRef(false);

    const clearActiveSession = useCallback(() => {
        clearTeacherSession();
        setCode("");
        setTeacherToken("");
        setSession(null);
        setIsRestoring(false);
    }, [setSession]);

    const restoreSession = useCallback(async () => {
        const storedSession = loadTeacherSession();
        if (!storedSession || restoreInFlightRef.current) {
            setIsRestoring(false);
            return;
        }

        restoreInFlightRef.current = true;
        setIsRestoring(true);

        const response = await sessionClient.joinTeacherSession(storedSession.code, storedSession.teacherToken);
        restoreInFlightRef.current = false;

        if (response?.ok) {
            setCode(storedSession.code);
            setTeacherToken(storedSession.teacherToken);
            setError("");
            setIsRestoring(false);
            return;
        }

        if (response?.code === "UNAUTHORIZED" || response?.code === "SESSION_NOT_FOUND") {
            clearActiveSession();
        } else if (
            response?.code !== "SOCKET_CONNECT_TIMEOUT" &&
            response?.code !== "SOCKET_CONNECT_ERROR" &&
            response?.code !== "ACK_TIMEOUT"
        ) {
            setError(getSocketErrorMessage(response, copy) || copy.errors.createSession);
        }

        setIsRestoring(false);
    }, [clearActiveSession, copy]);

    useEffect(() => {
        void Promise.resolve().then(restoreSession);
    }, [restoreSession]);

    useEffect(() => {
        if (connectionState === "connected") {
            void Promise.resolve().then(restoreSession);
        }
    }, [connectionState, restoreSession]);

    const handleAction = useCallback(async (action: () => Promise<AckResponse>) => {
        setError("");
        const response = await action();

        if (!response?.ok) {
            if (response?.code === "UNAUTHORIZED" || response?.code === "SESSION_NOT_FOUND") {
                clearActiveSession();
            }

            setError(getSocketErrorMessage(response, copy) || copy.errors.operationFailed);
        }
    }, [clearActiveSession, copy]);

    return {
        code,
        setCode,
        teacherToken,
        setTeacherToken,
        session,
        isRestoring,
        error,
        setError,
        handleAction,
        hasActiveSession: Boolean(code && teacherToken),
    };
}
