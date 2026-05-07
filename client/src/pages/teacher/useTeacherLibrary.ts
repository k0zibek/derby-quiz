import { useCallback, useMemo, useState } from "react";

import type { QuestionSetDraft, QuestionSetSummary, TextQuestionDraft } from "../../../../shared/types";
import { getSocketErrorMessage } from "../../i18n/helpers";
import type { AppMessages } from "../../i18n/types";
import { sessionClient } from "../../sessionClient";
import { saveTeacherSession } from "../../sessionStorage";
import type { TeacherMode } from "./TeacherViews";
import { createEmptyQuestionSet, toQuestionSetDraft } from "./questionDrafts";

type SessionStarter = {
    setCode: (code: string) => void;
    setTeacherToken: (teacherToken: string) => void;
    setTeacherMode: (mode: TeacherMode) => void;
};

export function useTeacherLibrary(copy: AppMessages, accessPin: string, sessionStarter: SessionStarter) {
    const [libraryAuthorized, setLibraryAuthorized] = useState(false);
    const [questionSets, setQuestionSets] = useState<QuestionSetSummary[]>([]);
    const [selectedSetId, setSelectedSetId] = useState("");
    const [editingSet, setEditingSet] = useState<QuestionSetDraft>(createEmptyQuestionSet);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [libraryError, setLibraryError] = useState("");
    const [libraryNotice, setLibraryNotice] = useState("");

    const selectedSet = useMemo(
        () => questionSets.find((questionSet) => questionSet.id === selectedSetId) ?? null,
        [questionSets, selectedSetId]
    );

    const refreshQuestionSets = useCallback(async (pin = accessPin) => {
        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.listQuestionSets(pin.trim());
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response, copy));
            return false;
        }

        setQuestionSets(response.questionSets);
        setLibraryAuthorized(true);
        setSelectedSetId((current) => current || response.questionSets[0]?.id || "");
        return true;
    }, [accessPin, copy]);

    const handleTeacherAccess = useCallback(async () => {
        if (!accessPin.trim()) {
            setLibraryError(copy.network.teacherAccessDenied);
            return;
        }

        await refreshQuestionSets(accessPin);
    }, [accessPin, copy, refreshQuestionSets]);

    const handleEditSelected = useCallback(async () => {
        if (!selectedSetId) return;

        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.updateQuestionSet(accessPin.trim(), selectedSetId, editingSet);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response, copy));
            return;
        }

        setEditingSet(toQuestionSetDraft(response.questionSet));
        setLibraryNotice(copy.teacherLibrary.saved);
        await refreshQuestionSets(accessPin);
    }, [accessPin, copy, editingSet, refreshQuestionSets, selectedSetId]);

    const handleSaveNew = useCallback(async () => {
        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.createQuestionSet(accessPin.trim(), editingSet);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response, copy));
            return;
        }

        setEditingSet(toQuestionSetDraft(response.questionSet));
        setSelectedSetId(response.questionSet.id);
        setLibraryNotice(copy.teacherLibrary.saved);
        await refreshQuestionSets(accessPin);
    }, [accessPin, copy, editingSet, refreshQuestionSets]);

    const handleLoadQuestionSet = useCallback(async (questionSetId: string) => {
        setSelectedSetId(questionSetId);
        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.getQuestionSet(accessPin.trim(), questionSetId);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response, copy));
            return;
        }

        setEditingSet(toQuestionSetDraft(response.questionSet));
    }, [accessPin, copy]);

    const handleDeleteSelected = useCallback(async () => {
        if (!selectedSetId || !window.confirm(copy.teacherLibrary.deleteConfirm)) return;

        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.deleteQuestionSet(accessPin.trim(), selectedSetId);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response, copy));
            return;
        }

        setSelectedSetId("");
        setEditingSet(createEmptyQuestionSet());
        setLibraryNotice(copy.teacherLibrary.deleted);
        await refreshQuestionSets(accessPin);
    }, [accessPin, copy, refreshQuestionSets, selectedSetId]);

    const handleStartSession = useCallback(async () => {
        if (!selectedSetId) {
            setLibraryError(copy.teacherLibrary.selectSet);
            return;
        }

        setLibraryLoading(true);
        setLibraryError("");
        const response = await sessionClient.createTeacherSession(accessPin.trim(), selectedSetId);
        setLibraryLoading(false);

        if (!response?.ok) {
            setLibraryError(getSocketErrorMessage(response, copy));
            return;
        }

        saveTeacherSession({
            code: response.code,
            teacherToken: response.teacherToken,
        });
        sessionStarter.setCode(response.code);
        sessionStarter.setTeacherToken(response.teacherToken);
        sessionStarter.setTeacherMode("preparation");
    }, [accessPin, copy, selectedSetId, sessionStarter]);

    const updateQuestion = useCallback((questionIndex: number, nextQuestion: TextQuestionDraft) => {
        setEditingSet((current) => ({
            ...current,
            questions: current.questions.map((question, index) => index === questionIndex ? nextQuestion : question),
        }));
    }, []);

    return {
        libraryAuthorized,
        questionSets,
        selectedSetId,
        selectedSet,
        editingSet,
        setEditingSet,
        libraryLoading,
        libraryError,
        libraryNotice,
        updateQuestion,
        handleTeacherAccess,
        handleEditSelected,
        handleSaveNew,
        handleLoadQuestionSet,
        handleDeleteSelected,
        handleStartSession,
    };
}
