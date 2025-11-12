import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';

const getTestUserDataPath = () => path.join(os.tmpdir(), 'aiverse-test');

// Mock Electron modules - must be hoisted and use factory function
vi.mock('electron', async () => {
  const os = await import('node:os');
  const pathMod = await import('node:path');
  
  const mockShell = {
    openExternal: vi.fn(),
    openPath: vi.fn(() => Promise.resolve('')),
    showItemInFolder: vi.fn()
  };
  
  const mockBrowserWindow = {
    getAllWindows: vi.fn(() => []),
    fromWebContents: vi.fn(() => ({
      webContents: {
        send: vi.fn()
      }
    }))
  };
  
  return {
    app: {
      getPath: vi.fn((name) => {
        if (name === 'userData') {
          return pathMod.join(os.tmpdir(), 'aiverse-test');
        }
        return pathMod.join(os.tmpdir(), 'test-path');
      })
    },
    BrowserWindow: mockBrowserWindow,
    dialog: {
      showOpenDialog: vi.fn(() => Promise.resolve({
        canceled: false,
        filePaths: [pathMod.join(os.tmpdir(), 'test-file')]
      }))
    },
    shell: mockShell,
    ipcMain: {
      handle: vi.fn()
    }
  };
});

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: vi.fn(() => ({
      on: vi.fn((event, handler) => {
        if (event === 'error') {
          // Don't call handler, simulating successful spawn
        }
      }),
      removeAllListeners: vi.fn(),
      unref: vi.fn()
    }))
  };
});

// Mock node:fs/promises for file operations
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readFile: vi.fn()
  };
});

import { registerIpcHandlers } from '../app/main/ipc.js';
import { getDb } from '../app/main/db.js';

describe('IPC Handlers', () => {
  let db;
  let handlers;

  beforeEach(async () => {
    const { ipcMain } = await import('electron');
    
    db = getDb();
    handlers = {};
    
    // Capture handlers registered by registerIpcHandlers
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
    
    registerIpcHandlers();
  });

  afterEach(() => {
    if (db) {
      db.prepare('DELETE FROM tools').run();
      db.prepare('DELETE FROM prompts').run();
      db.prepare('DELETE FROM files').run();
      db.prepare('DELETE FROM images').run();
      db.prepare('DELETE FROM recent').run();
    }
    vi.clearAllMocks();
  });

  describe('tools:list', () => {
    it('should return empty array when no tools exist', async () => {
      const result = await handlers['tools:list']({}, null);
      expect(result).toEqual([]);
    });

    it('should return all tools ordered by name', async () => {
      // Insert test tools
      db.prepare(`
        INSERT INTO tools (name, app_url) VALUES (?, ?)
      `).run('Zebra Tool', 'https://zebra.com');
      db.prepare(`
        INSERT INTO tools (name, app_url) VALUES (?, ?)
      `).run('Alpha Tool', 'https://alpha.com');

      const result = await handlers['tools:list']({}, null);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alpha Tool');
      expect(result[1].name).toBe('Zebra Tool');
    });

    it('should return tools with correct field mapping', async () => {
      db.prepare(`
        INSERT INTO tools (name, docs_url, app_url, exec_path, icon_path, images_folder, files_folder, settings_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('Test Tool', 'https://docs.com', 'https://app.com', '/path/to/exe', '/path/to/icon', '/images', '/files', '{"key":"value"}');

      const result = await handlers['tools:list']({}, null);
      
      expect(result[0]).toMatchObject({
        name: 'Test Tool',
        docsUrl: 'https://docs.com',
        appUrl: 'https://app.com',
        execPath: '/path/to/exe',
        iconPath: '/path/to/icon',
        imagesFolder: '/images',
        filesFolder: '/files',
        settingsJson: '{"key":"value"}'
      });
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('createdAt');
      expect(result[0]).toHaveProperty('updatedAt');
    });
  });

  describe('tools:create', () => {
    it('should create a new tool', async () => {
      const input = {
        name: 'New Tool',
        docsUrl: 'https://docs.example.com',
        appUrl: 'https://app.example.com',
        execPath: '/path/to/exec',
        iconPath: '/path/to/icon',
        imagesFolder: '/path/to/images',
        filesFolder: '/path/to/files',
        settings: { theme: 'dark' }
      };

      const result = await handlers['tools:create']({}, input);
      
      expect(result).toHaveProperty('id');
      expect(result.id).toBeGreaterThan(0);
      
      const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(result.id);
      expect(tool.name).toBe('New Tool');
      expect(tool.docs_url).toBe('https://docs.example.com');
      expect(tool.app_url).toBe('https://app.example.com');
      expect(tool.exec_path).toBe('/path/to/exec');
      expect(JSON.parse(tool.settings_json)).toEqual({ theme: 'dark' });
    });

    it('should handle null values for optional fields', async () => {
      const input = {
        name: 'Minimal Tool'
      };

      const result = await handlers['tools:create']({}, input);
      
      const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(result.id);
      expect(tool.name).toBe('Minimal Tool');
      expect(tool.docs_url).toBeNull();
      expect(tool.app_url).toBeNull();
      expect(tool.exec_path).toBeNull();
      expect(tool.settings_json).toBeNull();
    });

    it('should notify all windows when tool is created', async () => {
      const { BrowserWindow } = await import('electron');
      const mockWindow = {
        webContents: { send: vi.fn() }
      };
      BrowserWindow.getAllWindows.mockReturnValue([mockWindow]);

      const input = { name: 'Test Tool' };
      await handlers['tools:create']({}, input);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('tools:changed');
    });
  });

  describe('tools:update', () => {
    it('should update an existing tool', async () => {
      const insertResult = db.prepare(`
        INSERT INTO tools (name, app_url) VALUES (?, ?)
      `).run('Old Name', 'https://old.com');
      const toolId = Number(insertResult.lastInsertRowid);

      const input = {
        name: 'New Name',
        appUrl: 'https://new.com'
      };

      const result = await handlers['tools:update']({}, toolId, input);
      
      expect(result).toEqual({ ok: true });
      
      const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId);
      expect(tool.name).toBe('New Name');
      expect(tool.app_url).toBe('https://new.com');
    });

    it('should throw error when tool not found', () => {
      const input = { name: 'Test' };
      
      expect(() => {
        handlers['tools:update']({}, 99999, input);
      }).toThrow('Tool not found');
    });

    it('should preserve existing values when not provided', async () => {
      const insertResult = db.prepare(`
        INSERT INTO tools (name, app_url, docs_url) VALUES (?, ?, ?)
      `).run('Test Tool', 'https://app.com', 'https://docs.com');
      const toolId = Number(insertResult.lastInsertRowid);

      const input = { name: 'Updated Name' };
      await handlers['tools:update']({}, toolId, input);
      
      const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId);
      expect(tool.name).toBe('Updated Name');
      expect(tool.app_url).toBe('https://app.com');
      expect(tool.docs_url).toBe('https://docs.com');
    });
  });

  describe('tools:delete', () => {
    it('should delete a tool', async () => {
      const insertResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Tool to Delete');
      const toolId = Number(insertResult.lastInsertRowid);

      const result = await handlers['tools:delete']({}, toolId);
      
      expect(result).toEqual({ ok: true });
      
      const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId);
      expect(tool).toBeUndefined();
    });
  });

  describe('prompts:create', () => {
    it('should create a new prompt', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      const payload = {
        title: 'Test Prompt',
        content: 'This is a test prompt',
        tags: 'test, example'
      };

      const result = await handlers['prompts:create']({}, toolId, payload);
      
      expect(result).toHaveProperty('id');
      
      const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(result.id);
      expect(prompt.title).toBe('Test Prompt');
      expect(prompt.content).toBe('This is a test prompt');
      expect(prompt.tags).toBe('test, example');
      expect(prompt.tool_id).toBe(toolId);
    });

    it('should handle null tags', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      const payload = {
        title: 'No Tags Prompt',
        content: 'Content without tags'
      };

      const result = await handlers['prompts:create']({}, toolId, payload);
      
      const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(result.id);
      expect(prompt.tags).toBeNull();
    });
  });

  describe('prompts:list', () => {
    it('should return prompts for a tool', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      const prompt1Result = db.prepare(`
        INSERT INTO prompts (tool_id, title, content) VALUES (?, ?, ?)
      `).run(toolId, 'Prompt 1', 'Content 1');
      const prompt1Id = Number(prompt1Result.lastInsertRowid);
      
      db.prepare(`
        INSERT INTO prompts (tool_id, title, content) VALUES (?, ?, ?)
      `).run(toolId, 'Prompt 2', 'Content 2');

      // Update prompt 1 to ensure it has a newer updated_at timestamp
      db.prepare(`
        UPDATE prompts SET updated_at = datetime('now', '+1 second') WHERE id = ?
      `).run(prompt1Id);

      const result = await handlers['prompts:list']({}, toolId);
      
      expect(result).toHaveLength(2);
      // The most recently updated should be first
      expect(result[0].title).toBe('Prompt 1');
      expect(result[1].title).toBe('Prompt 2');
    });

    it('should return empty array when no prompts exist', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      const result = await handlers['prompts:list']({}, toolId);
      
      expect(result).toEqual([]);
    });
  });

  describe('prompts:update', () => {
    it('should update a prompt', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      const promptResult = db.prepare(`
        INSERT INTO prompts (tool_id, title, content) VALUES (?, ?, ?)
      `).run(toolId, 'Old Title', 'Old Content');
      const promptId = Number(promptResult.lastInsertRowid);

      const payload = {
        title: 'New Title',
        content: 'New Content',
        tags: 'updated'
      };

      const result = await handlers['prompts:update']({}, promptId, payload);
      
      expect(result).toEqual({ ok: true });
      
      const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(promptId);
      expect(prompt.title).toBe('New Title');
      expect(prompt.content).toBe('New Content');
      expect(prompt.tags).toBe('updated');
    });

    it('should throw error when prompt not found', () => {
      const payload = { title: 'Test' };
      
      expect(() => {
        handlers['prompts:update']({}, 99999, payload);
      }).toThrow('Prompt not found');
    });
  });

  describe('prompts:delete', () => {
    it('should delete a prompt', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      const promptResult = db.prepare(`
        INSERT INTO prompts (tool_id, title, content) VALUES (?, ?, ?)
      `).run(toolId, 'To Delete', 'Content');
      const promptId = Number(promptResult.lastInsertRowid);

      const result = await handlers['prompts:delete']({}, promptId);
      
      expect(result).toEqual({ ok: true });
      
      const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(promptId);
      expect(prompt).toBeUndefined();
    });
  });

  describe('prompts:exportAsJson', () => {
    it('should export prompts as JSON', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      db.prepare(`
        INSERT INTO prompts (tool_id, title, content) VALUES (?, ?, ?)
      `).run(toolId, 'Prompt 1', 'Content 1');

      const result = await handlers['prompts:exportAsJson']({}, toolId);
      
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0]).toMatchObject({
        toolId: toolId,
        title: 'Prompt 1',
        content: 'Content 1'
      });
    });
  });

  describe('open:url', () => {
    it('should open external URL', async () => {
      const { shell } = await import('electron');
      
      const result = await handlers['open:url']({}, 'https://example.com');
      
      expect(result).toEqual({ ok: true });
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('file:readAsDataUrl', () => {
    it('should read image file and return data URL', async () => {
      const fsMock = await import('node:fs/promises');
      fsMock.readFile.mockResolvedValueOnce(Buffer.from('fake-image-data'));

      const result = await handlers['file:readAsDataUrl']({}, '/path/to/image.png');
      
      expect(result).toBeTruthy();
      expect(result).toMatch(/^data:image\/png;base64,/);
      expect(fsMock.readFile).toHaveBeenCalledWith('/path/to/image.png');
    });

    it('should handle missing file gracefully', async () => {
      const fsMock = await import('node:fs/promises');
      fsMock.readFile.mockRejectedValueOnce(new Error('File not found'));

      const result = await handlers['file:readAsDataUrl']({}, '/nonexistent/file.png');
      
      expect(result).toBeNull();
      expect(fsMock.readFile).toHaveBeenCalledWith('/nonexistent/file.png');
    });
  });
});

