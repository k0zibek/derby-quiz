import type {
    AckResponse,
    QuestionSetDraft,
    QuestionSetSummary,
    TextQuestionDraft,
    TeacherState,
} from "../../../../shared/types";
import type { AppMessages } from "../../i18n/types";
import type { Locale, Theme } from "../../preferences";
import {
    AppShell,
    Button,
    InlineNotice,
    LanguageToggle,
    Modal,
    Panel,
    Progress,
    QrBlock,
    SegmentedTabs,
    StatusPill,
    ThemeToggle,
    TopBar,
} from "../../components/ui";
import { QuestionContent, QuestionOptionContent } from "../../components/QuestionContent";

export type TeacherMode = "library" | "preparation" | "live";

export type PrimaryAction = {
    label: string;
    tone: "success" | "warning" | "primary";
    disabled: boolean;
    run: () => Promise<AckResponse>;
    hint: string;
};

type PreferenceProps = {
    copy: AppMessages;
    locale: Locale;
    setLocale: (locale: Locale) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

type TeacherTabsProps = PreferenceProps & {
    value: TeacherMode;
    onChange: (mode: TeacherMode) => void;
    disabled?: Partial<Record<TeacherMode, boolean>>;
};

type TeacherTab = {
    value: TeacherMode;
    label: string;
    disabled?: boolean;
};

function teacherTab(value: TeacherMode, label: string, disabled?: boolean): TeacherTab {
    return disabled === undefined ? { value, label } : { value, label, disabled };
}

function PreferenceControls({ copy, locale, setLocale, theme, setTheme, value, onChange, disabled }: TeacherTabsProps) {
    return (
        <>
            <SegmentedTabs
                items={[
                    teacherTab("library", copy.teacher.modes.library, disabled?.library),
                    teacherTab("preparation", copy.teacher.modes.preparation, disabled?.preparation),
                    teacherTab("live", copy.teacher.modes.live, disabled?.live),
                ]}
                ariaLabel={copy.teacher.kicker}
                value={value}
                onChange={onChange}
            />
            <LanguageToggle locale={locale} onChange={setLocale} />
            <ThemeToggle theme={theme} onChange={setTheme} />
        </>
    );
}

export function TeacherAccessView({
    copy,
    locale,
    setLocale,
    theme,
    setTheme,
    isRestoring,
    accessPin,
    setAccessPin,
    libraryLoading,
    connectionMessage,
    libraryError,
    error,
    onTeacherAccess,
}: PreferenceProps & {
    isRestoring: boolean;
    accessPin: string;
    setAccessPin: (value: string) => void;
    libraryLoading: boolean;
    connectionMessage: string;
    libraryError: string;
    error: string;
    onTeacherAccess: () => void;
}) {
    return (
        <AppShell className="grid place-items-center p-5">
            <Panel className="w-full max-w-md p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusPill tone="blue">{copy.teacher.kicker}</StatusPill>
                    <div className="flex gap-2">
                        <LanguageToggle locale={locale} onChange={setLocale} />
                        <ThemeToggle theme={theme} onChange={setTheme} />
                    </div>
                </div>
                <h1 className="mt-5 text-3xl font-black leading-tight text-(--text)">
                    {isRestoring ? copy.teacher.restoreTitle : copy.teacher.accessTitle}
                </h1>
                <p className="mt-3 text-sm leading-6 text-(--text-muted)">
                    {isRestoring ? copy.teacher.restoreSubtitle : copy.teacher.accessSubtitle}
                </p>

                {isRestoring ? (
                    <InlineNotice>{copy.teacher.restoreHint}</InlineNotice>
                ) : (
                    <div className="mt-5 grid gap-3">
                        <input
                            className="h-14 rounded-xl border border-(--border) bg-(--surface-solid) px-4 text-base font-semibold text-(--text) outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                            placeholder={copy.teacher.accessPlaceholder}
                            value={accessPin}
                            onChange={(event) => setAccessPin(event.target.value)}
                            maxLength={32}
                        />
                        <Button onClick={onTeacherAccess} disabled={libraryLoading}>
                            {libraryLoading ? copy.buttons.connecting : copy.buttons.authorizeTeacher}
                        </Button>
                    </div>
                )}

                <div className="mt-4 grid gap-3">
                    {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                    {libraryError || error ? <InlineNotice tone="danger">{libraryError || error}</InlineNotice> : null}
                </div>
            </Panel>
        </AppShell>
    );
}

export function TeacherLibraryView({
    copy,
    locale,
    setLocale,
    theme,
    setTheme,
    questionSets,
    selectedSetId,
    selectedSet,
    editingSet,
    libraryLoading,
    connectionMessage,
    libraryNotice,
    libraryError,
    setEditingSet,
    updateQuestion,
    onLoadQuestionSet,
    onStartSession,
    onDeleteSelected,
    onEditSelected,
    onSaveNew,
    createEmptyQuestion,
    createEmptyQuestionSet,
    isDraftReady,
}: PreferenceProps & {
    questionSets: QuestionSetSummary[];
    selectedSetId: string;
    selectedSet: QuestionSetSummary | null;
    editingSet: QuestionSetDraft;
    libraryLoading: boolean;
    connectionMessage: string;
    libraryNotice: string;
    libraryError: string;
    setEditingSet: (updater: (current: QuestionSetDraft) => QuestionSetDraft) => void;
    updateQuestion: (questionIndex: number, nextQuestion: TextQuestionDraft) => void;
    onLoadQuestionSet: (questionSetId: string) => void;
    onStartSession: () => void;
    onDeleteSelected: () => void;
    onEditSelected: () => void;
    onSaveNew: () => void;
    createEmptyQuestion: () => TextQuestionDraft;
    createEmptyQuestionSet: () => QuestionSetDraft;
    isDraftReady: (draft: QuestionSetDraft) => boolean;
}) {
    return (
        <AppShell className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto grid w-full max-w-7xl gap-5">
                <TopBar
                    controls={(
                        <PreferenceControls
                            copy={copy}
                            locale={locale}
                            setLocale={setLocale}
                            theme={theme}
                            setTheme={setTheme}
                            value="library"
                            onChange={() => {}}
                            disabled={{ preparation: true, live: true }}
                        />
                    )}
                >
                    <div>
                        <StatusPill tone="blue">{copy.teacherLibrary.kicker}</StatusPill>
                        <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">{copy.teacherLibrary.title}</h1>
                    </div>
                </TopBar>
                <div className="flex justify-end">
                    <Button tone="neutral" onClick={() => setEditingSet(() => createEmptyQuestionSet())}>
                        {copy.teacherLibrary.newSet}
                    </Button>
                </div>

                <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
                    <Panel className="grid content-start gap-4">
                        <div>
                            <h2 className="text-lg font-black">{copy.teacherLibrary.setsTitle}</h2>
                            <p className="mt-1 text-sm leading-6 text-(--text-muted)">{copy.teacherLibrary.setsSubtitle}</p>
                        </div>
                        <div className="grid gap-2">
                            {questionSets.map((questionSet) => (
                                <button
                                    key={questionSet.id}
                                    className={`rounded-xl border p-3 text-left transition ${
                                        selectedSetId === questionSet.id
                                            ? "border-(--accent) bg-(--surface-soft)"
                                            : "border-(--border) bg-(--surface) hover:bg-(--surface-soft)"
                                    }`}
                                    onClick={() => onLoadQuestionSet(questionSet.id)}
                                >
                                    <div className="font-black">{questionSet.title}</div>
                                    <div className="mt-1 text-sm font-semibold text-(--text-muted)">
                                        {questionSet.questionCount} {copy.labels.question.toLowerCase()}
                                    </div>
                                </button>
                            ))}
                            {questionSets.length ? null : <InlineNotice>{copy.teacherLibrary.empty}</InlineNotice>}
                        </div>
                        <Button tone="success" disabled={!selectedSet || libraryLoading} onClick={onStartSession}>
                            {copy.teacherLibrary.startGame}
                        </Button>
                        <Button tone="danger" disabled={!selectedSetId || libraryLoading} onClick={onDeleteSelected}>
                            {copy.teacherLibrary.deleteSet}
                        </Button>
                    </Panel>

                    <Panel className="grid gap-5">
                        <div>
                            <div className="text-sm font-bold text-(--text-muted)">{copy.teacherLibrary.editorTitle}</div>
                            <input
                                className="mt-2 h-14 w-full rounded-xl border border-(--border) bg-(--surface-solid) px-4 text-xl font-black text-(--text) outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                placeholder={copy.teacherLibrary.titlePlaceholder}
                                value={editingSet.title}
                                onChange={(event) => setEditingSet((current) => ({ ...current, title: event.target.value }))}
                            />
                        </div>

                        <div className="grid gap-4">
                            {editingSet.questions.map((question, questionIndex) => (
                                <div key={question.id ?? questionIndex} className="rounded-xl border border-(--border) bg-(--surface-soft) p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <StatusPill>{copy.labels.question} {questionIndex + 1}</StatusPill>
                                        <Button
                                            tone="neutral"
                                            disabled={editingSet.questions.length <= 1}
                                            onClick={() => setEditingSet((current) => ({
                                                ...current,
                                                questions: current.questions.filter((_, index) => index !== questionIndex),
                                            }))}
                                        >
                                            {copy.teacherLibrary.removeQuestion}
                                        </Button>
                                    </div>
                                    <textarea
                                        className="mt-3 min-h-24 w-full rounded-xl border border-(--border) bg-(--surface-solid) px-4 py-3 text-base font-semibold text-(--text) outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                        placeholder={copy.teacherLibrary.stemPlaceholder}
                                        value={question.stem}
                                        onChange={(event) => updateQuestion(questionIndex, { ...question, stem: event.target.value })}
                                    />
                                    <div className="mt-3 grid gap-2">
                                        {question.options.map((option, optionIndex) => (
                                            <div key={optionIndex} className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2">
                                                <input
                                                    type="radio"
                                                    checked={question.correctIndex === optionIndex}
                                                    onChange={() => updateQuestion(questionIndex, { ...question, correctIndex: optionIndex })}
                                                    aria-label={`${copy.teacherLibrary.correctOption} ${optionIndex + 1}`}
                                                />
                                                <input
                                                    className="h-12 rounded-xl border border-(--border) bg-(--surface-solid) px-4 text-sm font-semibold text-(--text) outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                                    placeholder={`${copy.teacherLibrary.optionPlaceholder} ${optionIndex + 1}`}
                                                    value={option}
                                                    onChange={(event) => updateQuestion(questionIndex, {
                                                        ...question,
                                                        options: question.options.map((item, index) => index === optionIndex ? event.target.value : item),
                                                    })}
                                                />
                                                <Button
                                                    tone="neutral"
                                                    disabled={question.options.length <= 2}
                                                    onClick={() => updateQuestion(questionIndex, {
                                                        ...question,
                                                        options: question.options.filter((_, index) => index !== optionIndex),
                                                        correctIndex: Math.min(question.correctIndex, question.options.length - 2),
                                                    })}
                                                >
                                                    {copy.teacherLibrary.removeOption}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        tone="neutral"
                                        className="mt-3"
                                        disabled={question.options.length >= 6}
                                        onClick={() => updateQuestion(questionIndex, {
                                            ...question,
                                            options: [...question.options, ""],
                                        })}
                                    >
                                        {copy.teacherLibrary.addOption}
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Button
                                tone="neutral"
                                onClick={() => setEditingSet((current) => ({
                                    ...current,
                                    questions: [...current.questions, createEmptyQuestion()],
                                }))}
                            >
                                {copy.teacherLibrary.addQuestion}
                            </Button>
                            <Button
                                tone="success"
                                disabled={!isDraftReady(editingSet) || libraryLoading}
                                onClick={editingSet.id && selectedSetId === editingSet.id ? onEditSelected : onSaveNew}
                            >
                                {copy.teacherLibrary.saveSet}
                            </Button>
                        </div>

                        <div className="grid gap-3">
                            {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                            {libraryNotice ? <InlineNotice tone="success">{libraryNotice}</InlineNotice> : null}
                            {libraryError ? <InlineNotice tone="danger">{libraryError}</InlineNotice> : null}
                        </div>
                    </Panel>
                </div>
            </div>
        </AppShell>
    );
}

export function TeacherPreparationView({
    copy,
    locale,
    setLocale,
    theme,
    setTheme,
    teacherMode,
    setTeacherMode,
    joinUrl,
    screenUrl,
    code,
    selectedSet,
    totalQuestions,
    session,
    connectionMessage,
    error,
    copyText,
}: PreferenceProps & {
    teacherMode: TeacherMode;
    setTeacherMode: (mode: TeacherMode) => void;
    joinUrl: string;
    screenUrl: string;
    code: string;
    selectedSet: QuestionSetSummary | null;
    totalQuestions: number;
    session: TeacherState | null;
    connectionMessage: string;
    error: string;
    copyText: (text: string) => void;
}) {
    return (
        <AppShell className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto grid w-full max-w-7xl gap-5">
                <TopBar
                    controls={(
                        <PreferenceControls
                            copy={copy}
                            locale={locale}
                            setLocale={setLocale}
                            theme={theme}
                            setTheme={setTheme}
                            value={teacherMode}
                            onChange={setTeacherMode}
                            disabled={{ library: true }}
                        />
                    )}
                >
                    <StatusPill tone="blue">{copy.teacher.modes.preparation}</StatusPill>
                    <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">{copy.teacher.joinTitle}</h1>
                </TopBar>

                <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
                    <Panel className="grid content-start gap-5">
                        <QrBlock value={joinUrl} code={code} label={copy.labels.code} />
                        <div className="grid grid-cols-2 gap-3">
                            <Button tone="neutral" onClick={() => copyText(joinUrl)} disabled={!joinUrl}>
                                {copy.buttons.copyLink}
                            </Button>
                            <Button tone="neutral" onClick={() => copyText(screenUrl)} disabled={!screenUrl}>
                                {copy.buttons.copyScreen}
                            </Button>
                        </div>
                    </Panel>

                    <div className="grid gap-5">
                        <Panel className="grid gap-5">
                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                                <div>
                                    <div className="text-sm font-bold text-(--text-muted)">{copy.teacherLibrary.startGame}</div>
                                    <h2 className="mt-2 text-3xl font-black leading-tight">{selectedSet?.title || copy.teacherLibrary.selectSet}</h2>
                                    <p className="mt-2 text-sm leading-6 text-(--text-muted)">
                                        {selectedSet?.questionCount ?? totalQuestions} {copy.labels.question.toLowerCase()} · {session?.players.length ?? 0} {copy.labels.players.toLowerCase()}
                                    </p>
                                </div>
                                <Button tone="success" className="min-h-16 text-base" onClick={() => setTeacherMode("live")}>
                                    {copy.teacher.modes.live}
                                </Button>
                            </div>
                            <div className="grid gap-3">
                                {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                                {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                            </div>
                        </Panel>

                        <Panel>
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-black">{copy.teacher.rosterTitle}</h2>
                                <StatusPill>{session?.players.length ?? 0}</StatusPill>
                            </div>
                            <div className="mt-4 grid gap-2 md:grid-cols-2">
                                {(session?.players ?? []).map((player) => (
                                    <div key={player.id} className="flex items-center gap-3 rounded-xl bg-(--surface-soft) p-3">
                                        <span className="h-3 w-3 rounded-full" style={{ background: player.color }} />
                                        <div className="min-w-0 flex-1 truncate text-sm font-bold">{player.name}</div>
                                        <div className="text-sm font-black">{player.score}</div>
                                    </div>
                                ))}
                                {session?.players.length ? null : <InlineNotice>{copy.screen.empty}</InlineNotice>}
                            </div>
                        </Panel>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

export function TeacherLiveView({
    copy,
    locale,
    setLocale,
    theme,
    setTheme,
    teacherMode,
    setTeacherMode,
    session,
    screenUrl,
    joinUrl,
    code,
    currentQuestionNumber,
    totalQuestions,
    connectionMessage,
    error,
    primaryAction,
    adaptiveQuestion,
    resetOpen,
    setAdaptiveQuestion,
    updateAdaptiveOption,
    setResetOpen,
    isQuestionReady,
    copyText,
    handleAction,
    handleAddAdaptiveQuestion,
    resetGame,
}: PreferenceProps & {
    teacherMode: TeacherMode;
    setTeacherMode: (mode: TeacherMode) => void;
    session: TeacherState | null;
    screenUrl: string;
    joinUrl: string;
    code: string;
    currentQuestionNumber: number;
    totalQuestions: number;
    connectionMessage: string;
    error: string;
    primaryAction: PrimaryAction;
    adaptiveQuestion: TextQuestionDraft;
    resetOpen: boolean;
    setAdaptiveQuestion: (updater: (current: TextQuestionDraft) => TextQuestionDraft) => void;
    updateAdaptiveOption: (optionIndex: number, value: string) => void;
    setResetOpen: (open: boolean) => void;
    isQuestionReady: (question: TextQuestionDraft) => boolean;
    copyText: (text: string) => void;
    handleAction: (action: () => Promise<AckResponse>) => void;
    handleAddAdaptiveQuestion: () => void;
    resetGame: () => Promise<AckResponse>;
}) {
    return (
        <AppShell className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto grid w-full max-w-7xl gap-5">
                <TopBar
                    controls={(
                        <PreferenceControls
                            copy={copy}
                            locale={locale}
                            setLocale={setLocale}
                            theme={theme}
                            setTheme={setTheme}
                            value={teacherMode === "library" ? "live" : teacherMode}
                            onChange={setTeacherMode}
                            disabled={{ library: true }}
                        />
                    )}
                >
                    <div>
                        <StatusPill tone={session?.status === "finished" ? "green" : session?.status === "result" ? "amber" : session?.status === "question" ? "blue" : "neutral"}>
                            {session ? copy.states[session.status].text : copy.states.lobby.text}
                        </StatusPill>
                        <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">{copy.appName}</h1>
                    </div>
                </TopBar>
                <div className="flex justify-end">
                    <a
                        href={screenUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="button-screen-link inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition"
                    >
                        {copy.buttons.openScreen}
                    </a>
                </div>

                <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
                    <Panel className="grid content-start gap-5">
                        <QrBlock value={joinUrl} code={code} label={copy.labels.code} />
                        <div className="grid grid-cols-2 gap-3">
                            <Button tone="neutral" onClick={() => copyText(joinUrl)} disabled={!joinUrl}>
                                {copy.buttons.copyLink}
                            </Button>
                            <Button tone="neutral" onClick={() => copyText(screenUrl)} disabled={!screenUrl}>
                                {copy.buttons.copyScreen}
                            </Button>
                        </div>
                        <div className="rounded-xl bg-(--surface-soft) p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-(--text-muted)">{copy.labels.players}</div>
                            <div className="mt-1 text-4xl font-black">{session?.totalPlayers ?? 0}</div>
                        </div>
                    </Panel>

                    <div className="grid gap-5">
                        <Panel className="grid gap-5">
                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                                <div>
                                    <div className="text-sm font-bold text-(--text-muted)">{copy.teacher.nextActionLabel}</div>
                                    <h2 className="mt-2 text-3xl font-black leading-tight">{primaryAction.label}</h2>
                                    <p className="mt-2 text-sm leading-6 text-(--text-muted)">{primaryAction.hint}</p>
                                </div>
                                <Button
                                    tone={primaryAction.tone}
                                    className="min-h-16 text-base"
                                    disabled={primaryAction.disabled}
                                    onClick={() => handleAction(primaryAction.run)}
                                >
                                    {primaryAction.label}
                                </Button>
                            </div>

                            <div className="grid gap-3">
                                {connectionMessage ? <InlineNotice>{connectionMessage}</InlineNotice> : null}
                                {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
                            </div>
                        </Panel>

                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                            <Panel>
                                {session?.currentQuestion ? (
                                    <QuestionContent
                                        question={session.currentQuestion}
                                        badge={`${copy.labels.question} ${currentQuestionNumber} / ${totalQuestions}`}
                                        titleTag="h3"
                                        questionImageAlt={copy.labels.questionImageAlt}
                                    >
                                        {session.status === "result" ? (
                                            <div className="mt-4 grid gap-3">
                                                {session.currentQuestion.options.map((option, index) => {
                                                    const stat = session.optionStats?.find((item) => item.index === index);

                                                    return (
                                                        <div key={`${option.label}-${index}`} className="rounded-xl border border-(--border) bg-(--surface) p-3">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <QuestionOptionContent option={option} index={index} imageAlt={copy.labels.optionImageAlt} />
                                                                <StatusPill tone={stat?.isCorrect ? "green" : "neutral"}>
                                                                    {stat?.count ?? 0}
                                                                </StatusPill>
                                                            </div>
                                                            <Progress
                                                                className="mt-3"
                                                                value={session.totalPlayers ? ((stat?.count ?? 0) / session.totalPlayers) * 100 : 0}
                                                                color={stat?.isCorrect ? "#059669" : "#94a3b8"}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="mt-4">
                                                <Progress value={session.totalPlayers ? (session.answeredCount / session.totalPlayers) * 100 : 0} />
                                                <div className="mt-2 text-sm font-semibold text-(--text-muted)">
                                                    {session.answeredCount} / {session.totalPlayers} {copy.labels.answered.toLowerCase()}
                                                </div>
                                            </div>
                                        )}
                                    </QuestionContent>
                                ) : (
                                    <InlineNotice>{copy.teacher.currentQuestionEmpty}</InlineNotice>
                                )}
                            </Panel>

                            <div className="grid gap-5">
                                {(session?.status === "lobby" || session?.status === "result") ? (
                                    <Panel className="grid gap-3">
                                        <div>
                                            <h2 className="text-lg font-black">{copy.teacherLibrary.adaptiveTitle}</h2>
                                            <p className="mt-1 text-sm leading-6 text-(--text-muted)">{copy.teacherLibrary.adaptiveSubtitle}</p>
                                        </div>
                                        <textarea
                                            className="min-h-20 rounded-xl border border-(--border) bg-(--surface-solid) px-4 py-3 text-sm font-semibold text-(--text) outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                            placeholder={copy.teacherLibrary.stemPlaceholder}
                                            value={adaptiveQuestion.stem}
                                            onChange={(event) => setAdaptiveQuestion((current) => ({ ...current, stem: event.target.value }))}
                                        />
                                        {adaptiveQuestion.options.map((option, optionIndex) => (
                                            <div key={optionIndex} className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2">
                                                <input
                                                    type="radio"
                                                    checked={adaptiveQuestion.correctIndex === optionIndex}
                                                    onChange={() => setAdaptiveQuestion((current) => ({ ...current, correctIndex: optionIndex }))}
                                                    aria-label={`${copy.teacherLibrary.correctOption} ${optionIndex + 1}`}
                                                />
                                                <input
                                                    className="h-11 rounded-xl border border-(--border) bg-(--surface-solid) px-3 text-sm font-semibold text-(--text) outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                                    placeholder={`${copy.teacherLibrary.optionPlaceholder} ${optionIndex + 1}`}
                                                    value={option}
                                                    onChange={(event) => updateAdaptiveOption(optionIndex, event.target.value)}
                                                />
                                            </div>
                                        ))}
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                tone="neutral"
                                                disabled={adaptiveQuestion.options.length >= 6}
                                                onClick={() => setAdaptiveQuestion((current) => ({ ...current, options: [...current.options, ""] }))}
                                            >
                                                {copy.teacherLibrary.addOption}
                                            </Button>
                                            <Button
                                                tone="success"
                                                disabled={!isQuestionReady(adaptiveQuestion)}
                                                onClick={handleAddAdaptiveQuestion}
                                            >
                                                {copy.teacherLibrary.addToQueue}
                                            </Button>
                                        </div>
                                    </Panel>
                                ) : null}

                                <Panel>
                                    <div className="flex items-center justify-between gap-3">
                                        <h2 className="text-lg font-black">{copy.teacher.rosterTitle}</h2>
                                        <StatusPill>{session?.players.length ?? 0}</StatusPill>
                                    </div>
                                    <div className="mt-4 grid gap-2">
                                        {(session?.players ?? []).slice(0, 8).map((player) => (
                                            <div key={player.id} className="flex items-center gap-3 rounded-xl bg-(--surface-soft) p-3">
                                                <span className="h-3 w-3 rounded-full" style={{ background: player.color }} />
                                                <div className="min-w-0 flex-1 truncate text-sm font-bold">{player.name}</div>
                                                <div className="text-sm font-black">{player.score}</div>
                                            </div>
                                        ))}
                                        {session?.players.length ? null : <InlineNotice>{copy.screen.empty}</InlineNotice>}
                                    </div>
                                    <Button
                                        tone="danger"
                                        className="mt-5 w-full"
                                        disabled={!session?.canReset}
                                        onClick={() => setResetOpen(true)}
                                    >
                                        {copy.buttons.resetGame}
                                    </Button>
                                </Panel>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={resetOpen}
                title={copy.teacher.resetTitle}
                confirmLabel={copy.buttons.resetGame}
                cancelLabel={copy.buttons.cancel}
                onCancel={() => setResetOpen(false)}
                onConfirm={() => {
                    setResetOpen(false);
                    handleAction(resetGame);
                }}
            >
                {copy.teacher.resetBody}
            </Modal>
        </AppShell>
    );
}
