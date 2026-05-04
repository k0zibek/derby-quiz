import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
    code: text("code").primaryKey(),
    teacherToken: text("teacher_token").notNull(),
    status: text("status").notNull(),
    currentQuestionIndex: integer("current_question_index").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
});

export const players = sqliteTable(
    "players",
    {
        id: text("id").notNull(),
        sessionCode: text("session_code").notNull(),
        playerToken: text("player_token").notNull(),
        name: text("name").notNull(),
        score: integer("score").notNull(),
        progress: integer("progress").notNull(),
        color: text("color").notNull(),
        connected: integer("connected", { mode: "boolean" }).notNull(),
        answeredCurrent: integer("answered_current", { mode: "boolean" }).notNull(),
        selectedOption: integer("selected_option"),
        lastAnswerCorrect: integer("last_answer_correct", { mode: "boolean" }),
        joinedAt: integer("joined_at").notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.id, table.sessionCode] }),
    ]
);

export const answers = sqliteTable("answers", {
    id: text("id").primaryKey(),
    sessionCode: text("session_code").notNull(),
    playerId: text("player_id").notNull(),
    questionId: text("question_id").notNull(),
    questionIndex: integer("question_index").notNull(),
    optionIndex: integer("option_index").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    points: integer("points").notNull(),
    answeredAt: integer("answered_at").notNull(),
});

export const questionSets = sqliteTable("question_sets", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    questionsJson: text("questions_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
});

export const settings = sqliteTable("settings", {
    key: text("key").primaryKey(),
    valueJson: text("value_json").notNull(),
    updatedAt: integer("updated_at").notNull(),
});
