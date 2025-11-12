import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import Database from 'better-sqlite3';

let db = null;

export function getDb() {
  if (db) return db;

  const userData = app.getPath('userData');
  const dbPath = path.join(userData, 'aiverse.sqlite');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  migrate(db);
  return db;
}

function migrate(database) {
  database.exec(`PRAGMA journal_mode = WAL;`);

  // Create tools table if it doesn't exist
  database.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      docs_url TEXT,
      app_url TEXT,
      exec_path TEXT,
      icon_path TEXT,
      images_folder TEXT,
      files_folder TEXT,
      settings_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);

  // Migration: add docs_url and app_url if they don't exist (for old schemas)
  const columns = database.prepare(`PRAGMA table_info(tools)`).all();
  const columnNames = columns.map(c => c.name);
  
  if (!columnNames.includes('docs_url')) {
    database.exec(`ALTER TABLE tools ADD COLUMN docs_url TEXT;`);
  }
  if (!columnNames.includes('app_url')) {
    database.exec(`ALTER TABLE tools ADD COLUMN app_url TEXT;`);
  }
  
  // Migrate old site_url to docs_url if site_url exists
  if (columnNames.includes('site_url') && columnNames.includes('docs_url')) {
    database.exec(`UPDATE tools SET docs_url = site_url WHERE docs_url IS NULL AND site_url IS NOT NULL;`);
  }

  database.exec(`

    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      history_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE
    );
    
    -- Enable foreign key constraints
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      thumbnail_path TEXT,
      metadata_json TEXT,
      tags TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      thumbnail_path TEXT,
      metadata_json TEXT,
      tags TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}


