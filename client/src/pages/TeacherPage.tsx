import { useMemo, useState } from "react";

import type { AckResponse } from "../../../shared/types";
import { useAppPreferences } from "../appPreferencesContext";
import { getConnectionMessage, getSocketErrorMessage } from "../i18n/helpers";
import { useConnectionState, useTeacherActions } from "../hooks/sessionHooks";
import {
    TeacherAccessView,
    TeacherLibraryView,
    TeacherLiveView,
    TeacherPreparationView,
    type PrimaryAction,
    type TeacherMode,
} from "./teacher/TeacherViews";
import { createEmptyQuestion, createEmptyQuestionSet, isQuestionSetDraftReady, isTextQuestionDraftReady } from "./teacher/questionDrafts";
import { useTeacherLibrary } from "./teacher/useTeacherLibrary";
import { useTeacherSessionController } from "./teacher/useTeacherSessionController";

function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
}

export default function TeacherPage() {
    const { locale, setLocale, theme, setTheme, messages: copy } = useAppPreferences();
    const [accessPin, setAccessPin] = useState("");
    const [resetOpen, setResetOpen] = useState(false);
    const [teacherMode, setTeacherMode] = useState<TeacherMode>("library");
    const [adaptiveQuestion, setAdaptiveQuestion] = useState(createEmptyQuestion);
    const { connectionState, serverUrl } = useConnectionState();
    const {
        code,
        setCode,
        teacherToken,
        setTeacherToken,
        session,
        isRestoring,
        error,
        setError,
        handleAction,
        hasActiveSession,
    } = useTeacherSessionController(copy, connectionState);
    const actions = useTeacherActions(code, teacherToken);
    const sessionStarter = useMemo(() => ({ setCode, setTeacherToken, setTeacherMode }), [setCode, setTeacherToken]);
    const library = useTeacherLibrary(copy, accessPin, sessionStarter);

    const joinUrl = useMemo(() => (code ? `${window.location.origin}/join/${code}` : ""), [code]);
    const screenUrl = useMemo(() => (code ? `${window.location.origin}/screen/${code}` : ""), [code]);
    const currentQuestionNumber = (session?.currentQuestionIndex ?? 0) + 1;
    const totalQuestions = session?.totalQuestions ?? 0;
    const connectionMessage = getConnectionMessage(connectionState, serverUrl, copy);

    async function handleAddAdaptiveQuestion() {
        if (!isTextQuestionDraftReady(adaptiveQuestion)) {
            setError(copy.teacherLibrary.fillQuestion);
            return;
        }

        setError("");
        const response = await actions.addQuestion(adaptiveQuestion);
        if (!response?.ok) {
            setError(getSocketErrorMessage(response, copy));
            return;
        }

        setAdaptiveQuestion(createEmptyQuestion());
    }

    function updateAdaptiveOption(optionIndex: number, value: string) {
        setAdaptiveQuestion((current) => ({
            ...current,
            options: current.options.map((option, index) => index === optionIndex ? value : option),
        }));
    }

    const primaryAction: PrimaryAction = session?.canStart
        ? {
              label: copy.buttons.startQuestion,
              tone: "success",
              disabled: false,
              run: actions.startQuestion,
              hint: copy.teacher.nextActionStart,
          }
        : session?.canShowResults
          ? {
                label: copy.buttons.showResults,
                tone: "warning",
                disabled: false,
                run: actions.showResults,
                hint: copy.teacher.nextActionResults,
            }
          : session?.canGoNext
            ? {
                  label: copy.buttons.nextQuestion,
                  tone: "primary",
                  disabled: false,
                  run: actions.nextQuestion,
                  hint: copy.teacher.nextActionNext,
              }
            : {
                  label: copy.teacher.waitingAction,
                  tone: "primary",
                  disabled: true,
                  run: async () => ({ ok: true }),
                  hint: copy.teacher.nextActionWait,
              };

    if (!hasActiveSession && !library.libraryAuthorized) {
        return (
            <TeacherAccessView
                copy={copy}
                locale={locale}
                setLocale={setLocale}
                theme={theme}
                setTheme={setTheme}
                isRestoring={isRestoring}
                accessPin={accessPin}
                setAccessPin={setAccessPin}
                libraryLoading={library.libraryLoading}
                connectionMessage={connectionMessage}
                libraryError={library.libraryError}
                error={error}
                onTeacherAccess={library.handleTeacherAccess}
            />
        );
    }

    if (!hasActiveSession) {
        return (
            <TeacherLibraryView
                copy={copy}
                locale={locale}
                setLocale={setLocale}
                theme={theme}
                setTheme={setTheme}
                questionSets={library.questionSets}
                selectedSetId={library.selectedSetId}
                selectedSet={library.selectedSet}
                editingSet={library.editingSet}
                libraryLoading={library.libraryLoading}
                connectionMessage={connectionMessage}
                libraryNotice={library.libraryNotice}
                libraryError={library.libraryError}
                setEditingSet={(updater) => library.setEditingSet(updater)}
                updateQuestion={library.updateQuestion}
                onLoadQuestionSet={(questionSetId) => void library.handleLoadQuestionSet(questionSetId)}
                onStartSession={() => void library.handleStartSession()}
                onDeleteSelected={() => void library.handleDeleteSelected()}
                onEditSelected={() => void library.handleEditSelected()}
                onSaveNew={() => void library.handleSaveNew()}
                createEmptyQuestion={createEmptyQuestion}
                createEmptyQuestionSet={createEmptyQuestionSet}
                isDraftReady={isQuestionSetDraftReady}
            />
        );
    }

    if (teacherMode === "preparation") {
        return (
            <TeacherPreparationView
                copy={copy}
                locale={locale}
                setLocale={setLocale}
                theme={theme}
                setTheme={setTheme}
                teacherMode={teacherMode}
                setTeacherMode={setTeacherMode}
                joinUrl={joinUrl}
                screenUrl={screenUrl}
                code={code}
                selectedSet={library.selectedSet}
                totalQuestions={totalQuestions}
                session={session}
                connectionMessage={connectionMessage}
                error={error}
                copyText={copyText}
            />
        );
    }

    return (
        <TeacherLiveView
            copy={copy}
            locale={locale}
            setLocale={setLocale}
            theme={theme}
            setTheme={setTheme}
            teacherMode={teacherMode}
            setTeacherMode={setTeacherMode}
            session={session}
            screenUrl={screenUrl}
            joinUrl={joinUrl}
            code={code}
            currentQuestionNumber={currentQuestionNumber}
            totalQuestions={totalQuestions}
            connectionMessage={connectionMessage}
            error={error}
            primaryAction={primaryAction}
            adaptiveQuestion={adaptiveQuestion}
            resetOpen={resetOpen}
            setAdaptiveQuestion={(updater) => setAdaptiveQuestion(updater)}
            updateAdaptiveOption={updateAdaptiveOption}
            setResetOpen={setResetOpen}
            isQuestionReady={isTextQuestionDraftReady}
            copyText={copyText}
            handleAction={(action) => void handleAction(action)}
            handleAddAdaptiveQuestion={() => void handleAddAdaptiveQuestion()}
            resetGame={actions.resetGame}
        />
    );
}
