import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { PoemRecord, ResolvedPoemRun } from "./types.js";

const dbPath = resolve(process.env.SQLITE_PATH ?? "data/infinite-monkey.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS poems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    theme TEXT NOT NULL,
    first_char TEXT NOT NULL,
    second_char TEXT NOT NULL,
    third_char TEXT NOT NULL,
    poem TEXT NOT NULL,
    routed_model TEXT,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    protocol TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_poems_created_at ON poems(created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_poems_run_id ON poems(run_id);
`);

type SavePoemInput = {
  runId: string;
  round: number;
  config: ResolvedPoemRun;
  poem: string;
  routedModel?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const insertPoem = db.prepare(`
  INSERT INTO poems (
    run_id, round, theme, first_char, second_char, third_char, poem, routed_model,
    prompt_tokens, completion_tokens, total_tokens, protocol
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const listPoemsStatement = db.prepare(`
  SELECT
    id,
    run_id AS runId,
    round,
    theme,
    first_char AS firstChar,
    second_char AS secondChar,
    third_char AS thirdChar,
    poem,
    routed_model AS routedModel,
    prompt_tokens AS promptTokens,
    completion_tokens AS completionTokens,
    total_tokens AS totalTokens,
    protocol,
    created_at AS createdAt
  FROM poems
  ORDER BY datetime(created_at) DESC, id DESC
  LIMIT ? OFFSET ?
`);

const countPoemsStatement = db.prepare("SELECT COUNT(*) AS count FROM poems");

const statsStatement = db.prepare(`
  SELECT
    COUNT(*) AS poemCount,
    COALESCE(SUM(total_tokens), 0) AS totalTokens,
    COALESCE(SUM(completion_tokens), 0) AS completionTokens
  FROM poems
`);

export function savePoem(input: SavePoemInput) {
  const result = insertPoem.run(
    input.runId,
    input.round,
    input.config.theme,
    input.config.firstChar,
    input.config.secondChar,
    input.config.thirdChar,
    input.poem,
    input.routedModel ?? null,
    input.promptTokens,
    input.completionTokens,
    input.totalTokens,
    input.config.protocol
  );

  return Number(result.lastInsertRowid);
}

export function listPoems(limit: number, offset: number) {
  const rows = listPoemsStatement.all(limit, offset) as PoemRecord[];
  const countRow = countPoemsStatement.get() as { count: number };
  return {
    poems: rows,
    total: countRow.count
  };
}

export function getLibraryStats() {
  return statsStatement.get() as {
    poemCount: number;
    totalTokens: number;
    completionTokens: number;
  };
}

export function getDatabasePath() {
  return dbPath;
}
