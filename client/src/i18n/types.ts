import type { GameStatus } from "../../../shared/types";

export type TeacherModeMessageKey = "library" | "preparation" | "live";

export type StatusMessage = {
    text: string;
    className: string;
};

export type AppMessages = {
    appName: string;
    defaultPlayerName: string;
    labels: {
        code: string;
        status: string;
        players: string;
        answered: string;
        question: string;
        points: string;
        progress: string;
        currentQuestion: string;
        raceScreen: string;
        winners: string;
        topPlayers: string;
        linkForPlayers: string;
        linkForScreen: string;
        answerCount: string;
        questionImageAlt: string;
        optionImageAlt: (label: string) => string;
    };
    buttons: {
        connect: string;
        connecting: string;
        authorizeTeacher: string;
        startQuestion: string;
        showResults: string;
        nextQuestion: string;
        resetGame: string;
        copyLink: string;
        copyScreen: string;
        openScreen: string;
        cancel: string;
    };
    teacher: {
        kicker: string;
        accessTitle: string;
        restoreTitle: string;
        accessSubtitle: string;
        restoreSubtitle: string;
        accessPlaceholder: string;
        accessHint: string;
        restoreHint: string;
        subtitle: string;
        joinTitle: string;
        joinSubtitle: string;
        controlsTitle: string;
        controlsSubtitle: string;
        currentQuestionEmpty: string;
        nextActionLabel: string;
        nextActionStart: string;
        nextActionResults: string;
        nextActionNext: string;
        nextActionWait: string;
        waitingAction: string;
        rosterTitle: string;
        resetTitle: string;
        resetBody: string;
        modes: Record<TeacherModeMessageKey, string>;
    };
    teacherLibrary: {
        kicker: string;
        title: string;
        setsTitle: string;
        setsSubtitle: string;
        empty: string;
        newSet: string;
        startGame: string;
        deleteSet: string;
        deleteConfirm: string;
        deleted: string;
        saved: string;
        selectSet: string;
        editorTitle: string;
        titlePlaceholder: string;
        stemPlaceholder: string;
        optionPlaceholder: string;
        correctOption: string;
        removeQuestion: string;
        addQuestion: string;
        removeOption: string;
        addOption: string;
        saveSet: string;
        fillQuestion: string;
        adaptiveTitle: string;
        adaptiveSubtitle: string;
        addToQueue: string;
    };
    join: {
        entryTitle: string;
        waitingTitle: string;
        subtitle: string;
        placeholder: string;
        restore: string;
        shortNames: string;
        progressTitle: string;
        progressSubtitle: string;
        lobby: string;
        answerSent: string;
        answerHint: string;
        resultTitle: string;
        resultAccepted: string;
        resultHint: string;
        finishedTitle: string;
        finishedHint: string;
        thankYou: string;
    };
    screen: {
        title: string;
        empty: string;
        currentQuestionSubtitle: string;
    };
    states: Record<GameStatus, StatusMessage>;
    answerFeedback: {
        correct: string;
        incorrect: string;
    };
    network: {
        connecting: (serverUrl: string) => string;
        disconnected: (serverUrl: string) => string;
        connectTimeout: string;
        connectError: string;
        ackTimeout: string;
        teacherAccessDenied: string;
        unauthorized: string;
        genericJoin: string;
    };
    errors: {
        enterName: string;
        sessionNotFound: string;
        createSession: string;
        operationFailed: string;
        connectScreen: string;
    };
    race: {
        statusText: Record<GameStatus, string>;
    };
};
