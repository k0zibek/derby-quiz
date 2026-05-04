import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import * as schema from "./schema.js";

export type ClassroomDatabase = ReturnType<typeof createClassroomDatabase>;

export function createClassroomDatabase(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const sqlite = new Database(databasePath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            code TEXT PRIMARY KEY,
            teacher_token TEXT NOT NULL,
            status TEXT NOT NULL,
            current_question_index INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            snapshot_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS players (
            id TEXT NOT NULL,
            session_code TEXT NOT NULL,
            player_token TEXT NOT NULL,
            name TEXT NOT NULL,
            score INTEGER NOT NULL,
            progress INTEGER NOT NULL,
            color TEXT NOT NULL,
            connected INTEGER NOT NULL,
            answered_current INTEGER NOT NULL,
            selected_option INTEGER,
            last_answer_correct INTEGER,
            joined_at INTEGER NOT NULL,
            PRIMARY KEY (id, session_code)
        );

        CREATE TABLE IF NOT EXISTS answers (
            id TEXT PRIMARY KEY,
            session_code TEXT NOT NULL,
            player_id TEXT NOT NULL,
            question_id TEXT NOT NULL,
            question_index INTEGER NOT NULL,
            option_index INTEGER NOT NULL,
            is_correct INTEGER NOT NULL,
            points INTEGER NOT NULL,
            answered_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS question_sets (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            questions_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `);

    const db = drizzle(sqlite, { schema });

    return {
        db,
        sqlite,
        close: () => sqlite.close(),
    };
}
