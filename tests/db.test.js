import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const getTestUserDataPath = () => path.join(os.tmpdir(), 'aiverse-test');

// Mock Electron app - must be hoisted and use factory function
vi.mock('electron', async () => {
  const os = await import('node:os');
  const pathMod = await import('node:path');
  const tmpDir = pathMod.join(os.tmpdir(), 'aiverse-test');
  
  return {
    app: {
      getPath: vi.fn((name) => {
        if (name === 'userData') {
          return tmpDir;
        }
        return pathMod.join(os.tmpdir(), 'test-path');
      })
    }
  };
});

describe('Database Module', () => {
  let db;
  let dbModule;

  beforeAll(async () => {
    const { app } = await import('electron');
    const testDir = getTestUserDataPath();
    
    // Reset the mock
    app.getPath.mockReturnValue(testDir);
    
    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Import the module and get a fresh database instance for the entire test suite
    dbModule = await import('../app/main/db.js');
    db = dbModule.getDb();
  });

  afterAll(() => {
    // Clean up test database file at the end of all tests
    try {
      if (db && typeof db.close === 'function') {
        try {
          db.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    } catch (e) {
      // Ignore errors during database close
    }
    
    // Try to delete test database files in the test directory
    try {
      const testDir = getTestUserDataPath();
      if (fs.existsSync(testDir)) {
        const files = fs.readdirSync(testDir);
        files.forEach(file => {
          if (file.endsWith('.sqlite') || file.endsWith('.sqlite-wal') || file.endsWith('.sqlite-shm')) {
            try {
              fs.unlinkSync(path.join(testDir, file));
            } catch (e) {
              // File may still be locked, ignore
            }
          }
        });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should create database with correct schema', () => {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all();
    
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('tools');
    expect(tableNames).toContain('prompts');
    expect(tableNames).toContain('files');
    expect(tableNames).toContain('images');
    expect(tableNames).toContain('recent');
  });

  it('should create tools table with correct columns', () => {
    const columns = db.prepare('PRAGMA table_info(tools)').all();
    const columnNames = columns.map(c => c.name);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('docs_url');
    expect(columnNames).toContain('app_url');
    expect(columnNames).toContain('exec_path');
    expect(columnNames).toContain('icon_path');
    expect(columnNames).toContain('images_folder');
    expect(columnNames).toContain('files_folder');
    expect(columnNames).toContain('settings_json');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  it('should create prompts table with foreign key constraint', () => {
    const columns = db.prepare('PRAGMA table_info(prompts)').all();
    const columnNames = columns.map(c => c.name);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('tool_id');
    expect(columnNames).toContain('title');
    expect(columnNames).toContain('content');
    expect(columnNames).toContain('tags');
    expect(columnNames).toContain('history_json');
    
    // Check foreign key constraint
    const foreignKeys = db.prepare(`
      SELECT * FROM pragma_foreign_key_list('prompts')
    `).all();
    expect(foreignKeys.length).toBeGreaterThan(0);
    expect(foreignKeys[0].table).toBe('tools');
  });

  it('should enable WAL journal mode', () => {
    const journalMode = db.prepare('PRAGMA journal_mode').get();
    expect(journalMode.journal_mode.toLowerCase()).toBe('wal');
  });

  it('should handle database singleton pattern', () => {
    const db1 = dbModule.getDb();
    const db2 = dbModule.getDb();
    expect(db1).toBe(db2);
  });

  it('should create recent table with correct structure', () => {
    const columns = db.prepare('PRAGMA table_info(recent)').all();
    const columnNames = columns.map(c => c.name);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('kind');
    expect(columnNames).toContain('ref_id');
    expect(columnNames).toContain('last_used_at');
  });

  it('should handle migration for missing docs_url column', () => {
    // The migration should add docs_url if it doesn't exist
    const columns = db.prepare('PRAGMA table_info(tools)').all();
    const columnNames = columns.map(c => c.name);
    
    expect(columnNames).toContain('docs_url');
  });

  it('should handle migration for missing app_url column', () => {
    // The migration should add app_url if it doesn't exist
    const columns = db.prepare('PRAGMA table_info(tools)').all();
    const columnNames = columns.map(c => c.name);
    
    expect(columnNames).toContain('app_url');
  });

  it('should allow inserting tools with docs_url and app_url', () => {
    const stmt = db.prepare(`
      INSERT INTO tools (name, docs_url, app_url) VALUES (?, ?, ?)
    `);
    const result = stmt.run('Test Tool', 'https://docs.example.com', 'https://app.example.com');
    
    expect(result.lastInsertRowid).toBeGreaterThan(0);
    
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(result.lastInsertRowid);
    expect(tool.docs_url).toBe('https://docs.example.com');
    expect(tool.app_url).toBe('https://app.example.com');
  });
});

