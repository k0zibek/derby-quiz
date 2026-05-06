import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { AnswerRecord, PersistedSession, QuestionSet, QuestionSetSummary } from "../../shared/types.js";
import type { ClassroomDatabase } from "./database.js";
import { answers, players, questionSets, sessions, settings } from "./schema.js";

export class ClassroomRepository {
    constructor(private readonly database: ClassroomDatabase) {}

    listSessions(): PersistedSession[] {
        return this.database.db
            .select({ snapshotJson: sessions.snapshotJson })
            .from(sessions)
            .all()
            .map((row) => JSON.parse(row.snapshotJson) as PersistedSession);
    }

    saveSession(session: PersistedSession): void {
        this.database.db
            .insert(sessions)
            .values({
                code: session.code,
                teacherToken: session.teacherToken,
                status: session.status,
                currentQuestionIndex: session.currentQuestionIndex,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                expiresAt: session.expiresAt,
                snapshotJson: JSON.stringify(session),
            })
            .onConflictDoUpdate({
                target: sessions.code,
                set: {
                    teacherToken: session.teacherToken,
                    status: session.status,
                    currentQuestionIndex: session.currentQuestionIndex,
                    updatedAt: session.updatedAt,
                    expiresAt: session.expiresAt,
                    snapshotJson: JSON.stringify(session),
                },
            })
            .run();

        for (const player of Object.values(session.players)) {
            this.database.db
                .insert(players)
                .values({
                    id: player.id,
                    sessionCode: session.code,
                    playerToken: player.playerToken,
                    name: player.name,
                    score: player.score,
                    progress: player.progress,
                    color: player.color,
                    connected: player.connected,
                    answeredCurrent: player.answeredCurrent,
                    selectedOption: player.selectedOption,
                    lastAnswerCorrect: player.lastAnswerCorrect,
                    joinedAt: player.joinedAt,
                })
                .onConflictDoUpdate({
                    target: [players.id, players.sessionCode],
                    set: {
                        playerToken: player.playerToken,
                        name: player.name,
                        score: player.score,
                        progress: player.progress,
                        color: player.color,
                        connected: player.connected,
                        answeredCurrent: player.answeredCurrent,
                        selectedOption: player.selectedOption,
                        lastAnswerCorrect: player.lastAnswerCorrect,
                    },
                })
                .run();
        }
    }

    removeSession(code: string): void {
        this.database.db.delete(sessions).where(eq(sessions.code, code)).run();
    }

    recordAnswer(answer: Omit<AnswerRecord, "id" | "answeredAt"> & { id?: string; answeredAt?: number }): AnswerRecord {
        const record: AnswerRecord = {
            id: answer.id ?? nanoid(12),
            answeredAt: answer.answeredAt ?? Date.now(),
            ...answer,
        };

        this.database.db.insert(answers).values(record).run();
        return record;
    }

    listQuestionSets(): QuestionSetSummary[] {
        return this.database.db
            .select()
            .from(questionSets)
            .all()
            .map((row) => {
                const questions = JSON.parse(row.questionsJson) as QuestionSet["questions"];

                return {
                    id: row.id,
                    title: row.title,
                    questionCount: questions.length,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt,
                };
            })
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    getQuestionSet(id: string): QuestionSet | null {
        const row = this.database.db
            .select()
            .from(questionSets)
            .where(eq(questionSets.id, id))
            .get();

        if (!row) return null;

        return {
            id: row.id,
            title: row.title,
            questions: JSON.parse(row.questionsJson) as QuestionSet["questions"],
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    saveQuestionSet(questionSet: QuestionSet): void {
        this.database.db
            .insert(questionSets)
            .values({
                id: questionSet.id,
                title: questionSet.title,
                questionsJson: JSON.stringify(questionSet.questions),
                createdAt: questionSet.createdAt,
                updatedAt: questionSet.updatedAt,
            })
            .onConflictDoUpdate({
                target: questionSets.id,
                set: {
                    title: questionSet.title,
                    questionsJson: JSON.stringify(questionSet.questions),
                    updatedAt: questionSet.updatedAt,
                },
            })
            .run();
    }

    deleteQuestionSet(id: string): void {
        this.database.db.delete(questionSets).where(eq(questionSets.id, id)).run();
    }

    setSetting(key: string, value: unknown): void {
        this.database.db
            .insert(settings)
            .values({
                key,
                valueJson: JSON.stringify(value),
                updatedAt: Date.now(),
            })
            .onConflictDoUpdate({
                target: settings.key,
                set: {
                    valueJson: JSON.stringify(value),
                    updatedAt: Date.now(),
                },
            })
            .run();
    }
}
