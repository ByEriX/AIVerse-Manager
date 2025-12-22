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
      })),
      showSaveDialog: vi.fn(() => Promise.resolve({
        canceled: false,
        filePath: pathMod.join(os.tmpdir(), 'test-export.zip')
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

// Mock adm-zip - used for tools:export
vi.mock('adm-zip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      addLocalFile: vi.fn(),
      addFile: vi.fn(),
      writeZip: vi.fn(),
      extractAllTo: vi.fn()
    }))
  };
});

// Mock yauzl - used for tools:import (streaming extraction for large files)
vi.mock('yauzl', () => {
  return {
    default: {
      open: vi.fn((filePath, options, callback) => {
        // Mock zipfile object with proper event handling
        const eventHandlers = {};
        let readEntryCallCount = 0;
        const mockZipfile = {
          readEntry: vi.fn(() => {
            readEntryCallCount++;
            // Emit entry event for data.json on first call
            if (readEntryCallCount === 1 && eventHandlers['entry']) {
              eventHandlers['entry']({ fileName: 'data.json' });
            } else {
              // No more entries, emit end event
              setTimeout(() => {
                if (eventHandlers['end']) {
                  eventHandlers['end']();
                }
              }, 0);
            }
          }),
          openReadStream: vi.fn((entry, callback) => {
            // Mock read stream that pipes to write stream
            const mockReadStream = {
              pipe: vi.fn((writeStream) => {
                // Return write stream for chaining
                return writeStream;
              }),
              on: vi.fn()
            };
            callback(null, mockReadStream);
          }),
          on: vi.fn((event, handler) => {
            eventHandlers[event] = handler;
          })
        };
        callback(null, mockZipfile);
      })
    }
  };
});

// Mock sharp - used for image thumbnail generation
vi.mock('sharp', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toFile: vi.fn().mockResolvedValue(undefined)
    }))
  };
});

// Mock exifreader - used for image metadata reading
vi.mock('exifreader', () => {
  return {
    default: {
      load: vi.fn(() => ({
        exif: {
          Make: { description: 'Test Camera' },
          Model: { description: 'Test Model' },
          DateTime: { description: '2024-01-01' },
          Software: { description: 'Test Software' },
          Artist: { description: 'Test Artist' }
        },
        file: {
          'Image Width': { value: 1920 },
          'Image Height': { value: 1080 }
        },
        png: {
          Description: { description: 'Test Description' },
          Comment: { description: '{"prompt": "test prompt", "seed": 123}' },
          Software: { description: 'Test Software' }
        }
      }))
    }
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
      // Delete in order to respect foreign key constraints
      db.prepare('DELETE FROM recent').run();
      db.prepare('DELETE FROM images').run();
      db.prepare('DELETE FROM files').run();
      db.prepare('DELETE FROM prompts').run();
      db.prepare('DELETE FROM tools').run();
    }
    vi.clearAllMocks();
  });

  describe('tools:list', () => {
    it('should return empty array when no tools exist', async () => {
      // Ensure database is clean for this test
      db.prepare('DELETE FROM tools').run();
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

  describe('tools:export', () => {
    let mockFs;
    let mockDialog;

    beforeEach(async () => {
      mockFs = await import('node:fs/promises');
      const pathMod = await import('node:path');
      const { dialog } = await import('electron');
      mockDialog = dialog;
      
      // Get the mocked AdmZip and ensure it returns a proper instance
      const AdmZipModule = await import('adm-zip');
      const AdmZip = AdmZipModule.default;
      AdmZip.mockClear();
      
      // Ensure the mock returns an instance with the required methods
      AdmZip.mockImplementation(() => ({
        addLocalFile: vi.fn(),
        addFile: vi.fn(),
        writeZip: vi.fn()
      }));
      
      // Setup file system mocks
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockFs.copyFile = vi.fn().mockResolvedValue(undefined);
      mockFs.access = vi.fn().mockResolvedValue(undefined);
      mockFs.rm = vi.fn().mockResolvedValue(undefined);
      // Mock readdir to return Dirent-like objects for data.json
      mockFs.readdir = vi.fn().mockImplementation(async (dirPath, options) => {
        if (options?.withFileTypes) {
          // Return Dirent-like objects
          return [
            { name: 'data.json', isDirectory: () => false, isFile: () => true }
          ];
        }
        return ['data.json'];
      });
      
      mockDialog.showSaveDialog = vi.fn().mockResolvedValue({
        canceled: false,
        filePath: pathMod.join(os.tmpdir(), 'test-export.zip')
      });
    });

    it('should export tool data without files/images', async () => {
      // Create test data
      const toolResult = db.prepare(`
        INSERT INTO tools (name, app_url) VALUES (?, ?)
      `).run('Test Tool', 'https://test.com');
      const toolId = Number(toolResult.lastInsertRowid);

      db.prepare(`
        INSERT INTO prompts (tool_id, title, content) VALUES (?, ?, ?)
      `).run(toolId, 'Test Prompt', 'Prompt content');

      const result = await handlers['tools:export']({}, { includeFiles: false, includeImages: false });
      
      expect(result).toHaveProperty('ok', true);
      expect(result).toHaveProperty('filePath');
      expect(result.stats.tools).toBe(1);
      expect(result.stats.prompts).toBe(1);
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    it('should handle canceled export dialog', async () => {
      mockDialog.showSaveDialog.mockResolvedValueOnce({
        canceled: true,
        filePath: null
      });

      const result = await handlers['tools:export']({}, { includeFiles: false, includeImages: false });
      
      expect(result).toHaveProperty('canceled', true);
    });

    it('should handle export errors gracefully', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Write failed'));

      await expect(
        handlers['tools:export']({}, { includeFiles: false, includeImages: false })
      ).rejects.toThrow();
    });
  });

  describe('tools:import', () => {
    let mockFs;
    let fsSync;
    let mkdirSyncSpy;
    let createWriteStreamSpy;
    let originalMkdirSync;
    let originalCreateWriteStream;

    beforeEach(async () => {
      mockFs = await import('node:fs/promises');
      const pathMod = await import('node:path');
      fsSync = await import('node:fs');
      
      // Restore any existing spies first
      if (mkdirSyncSpy && typeof mkdirSyncSpy.mockRestore === 'function') {
        mkdirSyncSpy.mockRestore();
      }
      if (createWriteStreamSpy && typeof createWriteStreamSpy.mockRestore === 'function') {
        createWriteStreamSpy.mockRestore();
      }
      vi.restoreAllMocks();
      
      // Mock fsSync methods used by yauzl extraction
      // Store original implementations before mocking
      originalMkdirSync = fsSync.mkdirSync;
      originalCreateWriteStream = fsSync.createWriteStream;
      
      // Create mock functions
      const mockMkdirSync = vi.fn(() => {});
      const mockCreateWriteStream = vi.fn(() => ({
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(), 0);
          }
        }),
        pipe: vi.fn()
      }));
      
      // Replace with mocks - try Object.defineProperty first, fallback to direct assignment
      try {
        Object.defineProperty(fsSync, 'mkdirSync', {
          value: mockMkdirSync,
          writable: true,
          configurable: true,
          enumerable: true
        });
        Object.defineProperty(fsSync, 'createWriteStream', {
          value: mockCreateWriteStream,
          writable: true,
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        // If defineProperty fails (non-configurable), try direct assignment
        try {
          fsSync.mkdirSync = mockMkdirSync;
          fsSync.createWriteStream = mockCreateWriteStream;
        } catch (e2) {
          // If that also fails, the property is truly non-configurable
          // In this case, we can't mock it, but the test should still work
          console.warn('Could not mock fsSync methods:', e2);
        }
      }
      
      mkdirSyncSpy = fsSync.mkdirSync;
      createWriteStreamSpy = fsSync.createWriteStream;
      
      // Setup file system mocks
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockFs.copyFile = vi.fn().mockResolvedValue(undefined);
      mockFs.access = vi.fn().mockResolvedValue(undefined);
      mockFs.rm = vi.fn().mockResolvedValue(undefined);
      mockFs.stat = vi.fn().mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false
      });
      mockFs.readFile = vi.fn().mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        tools: [
          {
            id: 1,
            name: 'Imported Tool',
            appUrl: 'https://imported.com',
            docsUrl: null,
            execPath: null,
            iconPath: null,
            imagesFolder: null,
            filesFolder: null,
            settingsJson: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        prompts: [],
        files: [],
        images: []
      }));
    });

    it('should import tool data with skip mode', async () => {
      const pathMod = await import('node:path');
      const testZipPath = pathMod.join(os.tmpdir(), 'test-import.zip');
      
      // Create an existing tool with same name
      db.prepare(`
        INSERT INTO tools (name, app_url) VALUES (?, ?)
      `).run('Imported Tool', 'https://existing.com');

      const result = await handlers['tools:import']({}, testZipPath, {
        includeFiles: false,
        includeImages: false,
        mergeMode: 'skip'
      });
      
      expect(result).toHaveProperty('ok', true);
      expect(result.stats.tools.skipped).toBe(1);
      expect(result.stats.tools.created).toBe(0);
      
      // Verify existing tool was not modified
      const existingTool = db.prepare('SELECT * FROM tools WHERE name = ?').get('Imported Tool');
      expect(existingTool.app_url).toBe('https://existing.com');
    });

    it('should import tool data with replace mode', async () => {
      const pathMod = await import('node:path');
      const testZipPath = pathMod.join(os.tmpdir(), 'test-import.zip');
      
      // Create an existing tool with same name
      db.prepare(`
        INSERT INTO tools (name, app_url) VALUES (?, ?)
      `).run('Imported Tool', 'https://existing.com');

      const result = await handlers['tools:import']({}, testZipPath, {
        includeFiles: false,
        includeImages: false,
        mergeMode: 'replace'
      });
      
      expect(result).toHaveProperty('ok', true);
      expect(result.stats.tools.replaced).toBe(1);
      
      // Verify existing tool was replaced
      const updatedTool = db.prepare('SELECT * FROM tools WHERE name = ?').get('Imported Tool');
      expect(updatedTool.app_url).toBe('https://imported.com');
    });

    it('should import tool data with merge mode', async () => {
      const pathMod = await import('node:path');
      const testZipPath = pathMod.join(os.tmpdir(), 'test-import.zip');
      
      // Create an existing tool with same name
      db.prepare(`
        INSERT INTO tools (name, app_url) VALUES (?, ?)
      `).run('Imported Tool', 'https://existing.com');

      const result = await handlers['tools:import']({}, testZipPath, {
        includeFiles: false,
        includeImages: false,
        mergeMode: 'merge'
      });
      
      expect(result).toHaveProperty('ok', true);
      expect(result.stats.tools.created).toBe(1);
      
      // Verify new tool was created with "(imported)" suffix
      const newTool = db.prepare('SELECT * FROM tools WHERE name = ?').get('Imported Tool (imported)');
      expect(newTool).toBeDefined();
      expect(newTool.app_url).toBe('https://imported.com');
    });

    it('should handle import errors gracefully', async () => {
      const pathMod = await import('node:path');
      const testZipPath = pathMod.join(os.tmpdir(), 'test-import.zip');
      
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockFs.stat.mockRejectedValueOnce(error);

      await expect(
        handlers['tools:import']({}, testZipPath, {
          includeFiles: false,
          includeImages: false,
          mergeMode: 'skip'
        })
      ).rejects.toThrow();
    });

    afterEach(() => {
      // Restore original implementations after each test
      if (originalMkdirSync && fsSync) {
        try {
          Object.defineProperty(fsSync, 'mkdirSync', {
            value: originalMkdirSync,
            writable: true,
            configurable: true,
            enumerable: true
          });
        } catch (e) {
          // Ignore restore errors - property might be non-configurable
        }
      }
      if (originalCreateWriteStream && fsSync) {
        try {
          Object.defineProperty(fsSync, 'createWriteStream', {
            value: originalCreateWriteStream,
            writable: true,
            configurable: true,
            enumerable: true
          });
        } catch (e) {
          // Ignore restore errors - property might be non-configurable
        }
      }
      mkdirSyncSpy = null;
      createWriteStreamSpy = null;
      originalMkdirSync = null;
      originalCreateWriteStream = null;
    });
  });

  describe('file:saveTemplateIcon', () => {
    it('should save template icon from data URL', async () => {
      const mockFs = await import('node:fs/promises');
      const pathMod = await import('node:path');
      const { app } = await import('electron');
      
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const templateId = 'test-template';
      
      app.getPath.mockReturnValue(os.tmpdir());
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.writeFile = vi.fn().mockResolvedValue(undefined);
      
      const result = await handlers['file:saveTemplateIcon']({}, dataUrl, templateId);
      
      expect(result).toBeTruthy();
      expect(result).toContain('template-icons');
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should throw error for invalid data URL', async () => {
      const invalidDataUrl = 'not-a-data-url';
      
      await expect(
        handlers['file:saveTemplateIcon']({}, invalidDataUrl, 'test')
      ).rejects.toThrow('Invalid data URL format');
    });
  });

  describe('open:selectFolder', () => {
    it('should return selected folder path', async () => {
      const { dialog, BrowserWindow } = await import('electron');
      const pathMod = await import('node:path');
      const mockWindow = { webContents: {} };
      
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      dialog.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: [pathMod.join(os.tmpdir(), 'selected-folder')]
      });
      
      const result = await handlers['open:selectFolder']({ sender: {} }, {});
      
      expect(result).toBe(pathMod.join(os.tmpdir(), 'selected-folder'));
    });

    it('should return null when dialog is canceled', async () => {
      const { dialog, BrowserWindow } = await import('electron');
      const mockWindow = { webContents: {} };
      
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      dialog.showOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: []
      });
      
      const result = await handlers['open:selectFolder']({ sender: {} }, {});
      
      expect(result).toBeNull();
    });
  });

  describe('open:selectFile', () => {
    it('should return selected file path', async () => {
      const { dialog, BrowserWindow } = await import('electron');
      const pathMod = await import('node:path');
      const mockWindow = { webContents: {} };
      
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      dialog.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: [pathMod.join(os.tmpdir(), 'selected-file.txt')]
      });
      
      const result = await handlers['open:selectFile']({ sender: {} }, {});
      
      expect(result).toBe(pathMod.join(os.tmpdir(), 'selected-file.txt'));
    });

    it('should return null when dialog is canceled', async () => {
      const { dialog, BrowserWindow } = await import('electron');
      const mockWindow = { webContents: {} };
      
      BrowserWindow.fromWebContents.mockReturnValue(mockWindow);
      dialog.showOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: []
      });
      
      const result = await handlers['open:selectFile']({ sender: {} }, {});
      
      expect(result).toBeNull();
    });
  });

  describe('tools:open', () => {
    it('should open URL when app_url is set', async () => {
      const { shell } = await import('electron');
      const insertResult = db.prepare(`
        INSERT INTO tools (name, app_url) VALUES (?, ?)
      `).run('Web Tool', 'https://example.com');
      const toolId = Number(insertResult.lastInsertRowid);

      const result = await handlers['tools:open']({}, toolId);
      
      expect(result).toEqual({ ok: true });
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
      
      // Check recent was recorded
      const recent = db.prepare('SELECT * FROM recent WHERE kind = ? AND ref_id = ?').get('tool', toolId);
      expect(recent).toBeDefined();
    });

    it('should throw error when tool not found', async () => {
      await expect(
        handlers['tools:open']({}, 99999)
      ).rejects.toThrow('Tool not found');
    });

    it('should throw error when no execPath or appUrl configured', async () => {
      const insertResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Empty Tool');
      const toolId = Number(insertResult.lastInsertRowid);

      await expect(
        handlers['tools:open']({}, toolId)
      ).rejects.toThrow('No execPath or appUrl configured');
    });
  });

  describe('images:getById', () => {
    it('should return image with folder path', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name, images_folder) VALUES (?, ?)
      `).run('Test Tool', os.tmpdir());
      const toolId = Number(toolResult.lastInsertRowid);
      
      const imagePath = path.join(os.tmpdir(), 'subfolder', 'image.png');
      const imageResult = db.prepare(`
        INSERT INTO images (tool_id, path) VALUES (?, ?)
      `).run(toolId, imagePath);
      const imageId = Number(imageResult.lastInsertRowid);

      const result = await handlers['images:getById']({}, imageId);
      
      expect(result).toMatchObject({
        id: imageId,
        path: imagePath,
        name: 'image.png'
      });
      expect(result).toHaveProperty('folderPath');
    });

    it('should return null when image not found', async () => {
      const result = await handlers['images:getById']({}, 99999);
      expect(result).toBeNull();
    });
  });

  describe('images:scan', () => {
    let mockFs;

    beforeEach(async () => {
      mockFs = await import('node:fs/promises');
      mockFs.readdir = vi.fn().mockResolvedValue([
        { name: 'image1.png', isDirectory: () => false, isFile: () => true },
        { name: 'subfolder', isDirectory: () => true, isFile: () => false }
      ]);
      mockFs.stat = vi.fn().mockResolvedValue({
        size: 1024,
        mtime: new Date('2024-01-01')
      });
    });

    it('should scan images folder and return folders and images', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name, images_folder) VALUES (?, ?)
      `).run('Test Tool', os.tmpdir());
      const toolId = Number(toolResult.lastInsertRowid);

      const result = await handlers['images:scan']({}, toolId, '');
      
      expect(result).toHaveProperty('folders');
      expect(result).toHaveProperty('images');
      expect(result.folders).toHaveLength(1);
      expect(result.images).toHaveLength(1);
    });

    it('should throw error when no images folder configured', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      await expect(
        handlers['images:scan']({}, toolId, '')
      ).rejects.toThrow('No images folder configured');
    });
  });

  describe('images:getThumbnail', () => {
    it('should return existing thumbnail if available', async () => {
      const mockFs = await import('node:fs/promises');
      const { app } = await import('electron');
      const pathMod = await import('node:path');
      
      const imagePath = '/path/to/image.png';
      const imageId = 1;
      const thumbPath = pathMod.join(os.tmpdir(), 'thumbnails', `thumb_${imageId}.jpg`);
      
      app.getPath.mockReturnValue(os.tmpdir());
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.access = vi.fn().mockResolvedValue(undefined);
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('thumbnail-data'));

      const result = await handlers['images:getThumbnail']({}, imagePath, imageId);
      
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
      expect(mockFs.readFile).toHaveBeenCalledWith(thumbPath);
    });

    it('should generate thumbnail if not exists', async () => {
      const mockFs = await import('node:fs/promises');
      const sharp = await import('sharp');
      const { app } = await import('electron');
      const pathMod = await import('node:path');
      
      const imagePath = '/path/to/image.png';
      const imageId = 1;
      const thumbPath = pathMod.join(os.tmpdir(), 'thumbnails', `thumb_${imageId}.jpg`);
      
      app.getPath.mockReturnValue(os.tmpdir());
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.access = vi.fn().mockRejectedValue(new Error('Not found'));
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('thumbnail-data'));
      
      const mockSharpInstance = {
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toFile: vi.fn().mockResolvedValue(undefined)
      };
      sharp.default.mockReturnValue(mockSharpInstance);

      const result = await handlers['images:getThumbnail']({}, imagePath, imageId);
      
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(400, 300, { fit: 'cover', position: 'center' });
      expect(mockSharpInstance.toFile).toHaveBeenCalledWith(thumbPath);
    });

    it('should return null on thumbnail generation error', async () => {
      const mockFs = await import('node:fs/promises');
      const sharp = await import('sharp');
      const { app } = await import('electron');
      
      const imagePath = '/path/to/image.png';
      const imageId = 1;
      
      app.getPath.mockReturnValue(os.tmpdir());
      mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
      mockFs.access = vi.fn().mockRejectedValue(new Error('Not found'));
      
      const mockSharpInstance = {
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toFile: vi.fn().mockRejectedValue(new Error('Generation failed'))
      };
      sharp.default.mockReturnValue(mockSharpInstance);

      const result = await handlers['images:getThumbnail']({}, imagePath, imageId);
      
      expect(result).toBeNull();
    });
  });

  describe('images:readMetadata', () => {
    let mockExifReader;
    let mockFs;

    beforeEach(async () => {
      mockFs = await import('node:fs/promises');
      mockExifReader = (await import('exifreader')).default;
      // Reset mock to default
      mockExifReader.load.mockReturnValue({
        exif: {
          Make: { description: 'Test Camera' },
          Model: { description: 'Test Model' },
          DateTime: { description: '2024-01-01' },
          Software: { description: 'Test Software' },
          Artist: { description: 'Test Artist' }
        },
        file: {
          'Image Width': { value: 1920 },
          'Image Height': { value: 1080 }
        },
        png: {
          Description: { description: 'Test Description' },
          Comment: { description: '{"prompt": "test prompt", "seed": 123}' },
          Software: { description: 'Test Software' }
        }
      });
    });

    it('should read image metadata', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result).toHaveProperty('camera');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
    });

    it('should parse NovelAI JSON metadata from PNG comment', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          Comment: { description: JSON.stringify({ prompt: 'test prompt', uc: 'negative', steps: 20, sampler: 'Euler', scale: 7.5, seed: 12345 }) }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.prompt).toBe('test prompt');
      expect(result.ai.negativePrompt).toBe('negative');
      expect(result.ai.steps).toBe(20);
      expect(result.ai.sampler).toBe('Euler');
      expect(result.ai.cfgScale).toBe(7.5);
      expect(result.ai.seed).toBe(12345);
    });

    it('should parse SD parameters chunk (case-insensitive)', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          Parameters: { description: 'test prompt\nNegative prompt: negative\nSteps: 25, Sampler: DPM++ 2M Karras, CFG scale: 7, Seed: 67890, Model: test-model' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.prompt).toBe('test prompt');
      expect(result.ai.negativePrompt).toBe('negative');
      expect(result.ai.steps).toBe('25');
      expect(result.ai.sampler).toBe('DPM++ 2M Karras');
      expect(result.ai.cfgScale).toBe('7');
      expect(result.ai.seed).toBe('67890');
      expect(result.ai.model).toBe('test-model');
    });

    it('should prefer NovelAI over SD when both present', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          Comment: { description: JSON.stringify({ prompt: 'NovelAI prompt', uc: 'NovelAI negative', steps: 20, seed: 11111 }) },
          Parameters: { description: 'SD prompt\nNegative prompt: SD negative\nSteps: 30, Seed: 22222' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      // NovelAI values should take priority
      expect(result.ai.prompt).toBe('NovelAI prompt');
      expect(result.ai.negativePrompt).toBe('NovelAI negative');
      expect(result.ai.steps).toBe(20);
      expect(result.ai.seed).toBe(11111);
      // SD parameters should fill missing fields, but not overwrite NovelAI
      // Since NovelAI already set these, SD shouldn't overwrite
    });

    it('should parse SD-specific fields from parameters chunk', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      // SD parameters typically use newlines, not commas
      const sdParams = [
        'test prompt',
        'Negative prompt: negative',
        'Steps: 30',
        'Sampler: Euler a',
        'CFG scale: 7.5',
        'Seed: 12345',
        'Size: 512x768',
        'Model hash: abc123',
        'VAE: vae-ft-mse-840000',
        'VAE hash: def456',
        'Clip skip: 2',
        'Scheduler: karras',
        'Hires upscaler: Latent',
        'Hires steps: 10',
        'Hires upscale: 1.5',
        'Denoising strength: 0.7',
        'ENSD: 31337',
        'Lora: lora1:0.8, lora2:0.5',
        'Lora hashes: "lora1:hash1, lora2:hash2"',
        'TI hashes: "ti1:hash1"'
      ].join('\n');
      
      mockExifReader.load.mockReturnValue({
        png: {
          parameters: { description: sdParams } // lowercase 'parameters'
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.prompt).toBe('test prompt');
      expect(result.ai.size).toBe('512x768');
      expect(result.ai.modelHash).toBe('abc123');
      expect(result.ai.vae).toBe('vae-ft-mse-840000');
      expect(result.ai.vaeHash).toBe('def456');
      expect(result.ai.clipSkip).toBe('2');
      expect(result.ai.scheduler).toBe('karras');
      expect(result.ai.hiresUpscaler).toBe('Latent');
      expect(result.ai.hiresSteps).toBe('10');
      expect(result.ai.hiresUpscale).toBe('1.5');
      expect(result.ai.denoisingStrength).toBe('0.7');
      expect(result.ai.ensd).toBe('31337');
      expect(result.ai.loras).toBeDefined();
      expect(result.ai.loraHashes).toBe('"lora1:hash1, lora2:hash2"');
      expect(result.ai.tiHashes).toBe('"ti1:hash1"');
    });

    it('should populate width/height from parsed size if EXIF missing', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        file: {}, // No width/height in EXIF
        png: {
          parameters: { description: 'test prompt\nSize: 1024x768' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
      expect(result.ai.size).toBe('1024x768');
    });

    it('should normalize software names', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          Software: { description: 'Automatic1111' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai.software).toBe('Stable Diffusion WebUI (A1111)');
    });

    it('should normalize A1111 software variant', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          Software: { description: 'A1111' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai.software).toBe('Stable Diffusion WebUI (A1111)');
    });

    it('should normalize InvokeAI software', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          Software: { description: 'InvokeAI' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai.software).toBe('InvokeAI');
    });

    it('should parse SD metadata from JPEG EXIF UserComment', async () => {
      const imagePath = '/path/to/image.jpg';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        exif: {
          UserComment: { description: 'test prompt\nNegative prompt: negative\nSteps: 25, Sampler: Euler, CFG scale: 7' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.prompt).toBe('test prompt');
      expect(result.ai.negativePrompt).toBe('negative');
      expect(result.ai.steps).toBe('25');
    });

    it('should parse SD metadata from JPEG EXIF ImageDescription', async () => {
      const imagePath = '/path/to/image.jpg';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        exif: {
          ImageDescription: { description: 'test prompt\nSteps: 30, Seed: 99999' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.prompt).toBe('test prompt');
      expect(result.ai.steps).toBe('30');
      expect(result.ai.seed).toBe('99999');
    });

    it('should parse SD metadata from IPTC Caption', async () => {
      const imagePath = '/path/to/image.jpg';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        iptc: {
          Caption: { description: 'test prompt\nNegative prompt: negative\nSteps: 20' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.prompt).toBe('test prompt');
      expect(result.ai.negativePrompt).toBe('negative');
      expect(result.ai.steps).toBe('20');
    });

    it('should parse SD metadata from XMP Parameters', async () => {
      const imagePath = '/path/to/image.jpg';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        xmp: {
          Parameters: { description: 'test prompt\nSteps: 15, Seed: 55555' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.prompt).toBe('test prompt');
      expect(result.ai.steps).toBe('15');
      expect(result.ai.seed).toBe('55555');
    });

    it('should handle case-insensitive field matching', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          parameters: { description: 'test\nCFG Scale: 8, Sampling method: DPM++' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.cfgScale).toBe('8');
      expect(result.ai.sampler).toBe('DPM++');
    });

    it('should handle Hires size format', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          parameters: { description: 'test prompt\nHires size: 1536x1024' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.size).toBe('1536x1024');
    });

    it('should handle multiple Lora entries', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          parameters: { description: 'test prompt\nLora: lora1:0.8\nLora: lora2:0.5\nLora: lora3:1.0' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(Array.isArray(result.ai.loras)).toBe(true);
      expect(result.ai.loras.length).toBe(3);
      expect(result.ai.loras).toContain('lora1:0.8');
      expect(result.ai.loras).toContain('lora2:0.5');
      expect(result.ai.loras).toContain('lora3:1.0');
    });

    it('should handle single Lora entry', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          parameters: { description: 'test prompt\nLora: lora1:0.8' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      expect(result.ai.loras).toBe('lora1:0.8');
    });

    it('should not overwrite existing values when parsing SD parameters after NovelAI', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockResolvedValue(Buffer.from('image-data'));
      
      mockExifReader.load.mockReturnValue({
        png: {
          Comment: { description: JSON.stringify({ prompt: 'NovelAI prompt', steps: 20, seed: 11111 }) },
          parameters: { description: 'SD prompt\nSteps: 30, Seed: 22222, Model: sd-model' }
        }
      });

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeTruthy();
      expect(result.ai).toBeDefined();
      // NovelAI values should be preserved
      expect(result.ai.prompt).toBe('NovelAI prompt');
      expect(result.ai.steps).toBe(20);
      expect(result.ai.seed).toBe(11111);
      // SD should fill model (which NovelAI didn't set)
      expect(result.ai.model).toBe('sd-model');
    });

    it('should return null on error', async () => {
      const imagePath = '/path/to/image.png';
      mockFs.readFile = vi.fn().mockRejectedValue(new Error('Read failed'));

      const result = await handlers['images:readMetadata']({}, imagePath);
      
      expect(result).toBeNull();
    });
  });

  describe('images:delete', () => {
    it('should delete image from database', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      const imageResult = db.prepare(`
        INSERT INTO images (tool_id, path) VALUES (?, ?)
      `).run(toolId, '/path/to/image.png');
      const imageId = Number(imageResult.lastInsertRowid);

      const result = await handlers['images:delete']({}, imageId, false);
      
      expect(result).toEqual({ ok: true });
      
      const image = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId);
      expect(image).toBeUndefined();
    });

    it('should delete image file when deleteDiskFile is true', async () => {
      const mockFs = await import('node:fs/promises');
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      const imagePath = '/path/to/image.png';
      const imageResult = db.prepare(`
        INSERT INTO images (tool_id, path) VALUES (?, ?)
      `).run(toolId, imagePath);
      const imageId = Number(imageResult.lastInsertRowid);

      mockFs.unlink = vi.fn().mockResolvedValue(undefined);

      const result = await handlers['images:delete']({}, imageId, true);
      
      expect(result).toEqual({ ok: true });
      expect(mockFs.unlink).toHaveBeenCalledWith(imagePath);
    });

    it('should throw error when image not found', async () => {
      await expect(
        handlers['images:delete']({}, 99999, false)
      ).rejects.toThrow('Image not found');
    });
  });

  describe('images:updateTags', () => {
    it('should update image tags', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      const imageResult = db.prepare(`
        INSERT INTO images (tool_id, path) VALUES (?, ?)
      `).run(toolId, '/path/to/image.png');
      const imageId = Number(imageResult.lastInsertRowid);

      const result = await handlers['images:updateTags']({}, imageId, 'tag1, tag2');
      
      expect(result).toEqual({ ok: true });
      
      const image = db.prepare('SELECT tags FROM images WHERE id = ?').get(imageId);
      expect(image.tags).toBe('tag1, tag2');
    });
  });

  describe('images:showInFolder', () => {
    it('should show image in folder', async () => {
      const { shell } = await import('electron');
      const imagePath = '/path/to/image.png';

      const result = await handlers['images:showInFolder']({}, imagePath);
      
      expect(result).toEqual({ ok: true });
      expect(shell.showItemInFolder).toHaveBeenCalledWith(imagePath);
    });
  });

  describe('images:openInViewer', () => {
    it('should open image in viewer and record recent', async () => {
      const { shell } = await import('electron');
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      const imagePath = '/path/to/image.png';
      const imageResult = db.prepare(`
        INSERT INTO images (tool_id, path) VALUES (?, ?)
      `).run(toolId, imagePath);
      const imageId = Number(imageResult.lastInsertRowid);

      shell.openPath = vi.fn().mockResolvedValue('');

      const result = await handlers['images:openInViewer']({}, imagePath);
      
      expect(result).toEqual({ ok: true });
      expect(shell.openPath).toHaveBeenCalledWith(imagePath);
      
      const recent = db.prepare('SELECT * FROM recent WHERE kind = ? AND ref_id = ?').get('image', imageId);
      expect(recent).toBeDefined();
    });
  });

  describe('images:openFolder', () => {
    it('should open images folder', async () => {
      const { shell } = await import('electron');
      const toolResult = db.prepare(`
        INSERT INTO tools (name, images_folder) VALUES (?, ?)
      `).run('Test Tool', os.tmpdir());
      const toolId = Number(toolResult.lastInsertRowid);

      shell.openPath = vi.fn().mockResolvedValue('');

      const result = await handlers['images:openFolder']({}, toolId);
      
      expect(result).toEqual({ ok: true });
      expect(shell.openPath).toHaveBeenCalledWith(os.tmpdir());
    });
  });

  describe('files:getById', () => {
    it('should return file with folder path', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name, files_folder) VALUES (?, ?)
      `).run('Test Tool', os.tmpdir());
      const toolId = Number(toolResult.lastInsertRowid);
      
      const filePath = path.join(os.tmpdir(), 'subfolder', 'file.txt');
      const fileResult = db.prepare(`
        INSERT INTO files (tool_id, path) VALUES (?, ?)
      `).run(toolId, filePath);
      const fileId = Number(fileResult.lastInsertRowid);

      const result = await handlers['files:getById']({}, fileId);
      
      expect(result).toMatchObject({
        id: fileId,
        path: filePath,
        name: 'file.txt'
      });
      expect(result).toHaveProperty('folderPath');
    });

    it('should return null when file not found', async () => {
      const result = await handlers['files:getById']({}, 99999);
      expect(result).toBeNull();
    });
  });

  describe('files:scan', () => {
    let mockFs;

    beforeEach(async () => {
      mockFs = await import('node:fs/promises');
      mockFs.readdir = vi.fn().mockResolvedValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'subfolder', isDirectory: () => true, isFile: () => false }
      ]);
      mockFs.stat = vi.fn().mockResolvedValue({
        size: 2048,
        mtime: new Date('2024-01-01')
      });
    });

    it('should scan files folder and return folders and files', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name, files_folder) VALUES (?, ?)
      `).run('Test Tool', os.tmpdir());
      const toolId = Number(toolResult.lastInsertRowid);

      const result = await handlers['files:scan']({}, toolId, '');
      
      expect(result).toHaveProperty('folders');
      expect(result).toHaveProperty('files');
      expect(result.folders).toHaveLength(1);
      expect(result.files).toHaveLength(1);
    });

    it('should throw error when no files folder configured', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      await expect(
        handlers['files:scan']({}, toolId, '')
      ).rejects.toThrow('No files folder configured');
    });
  });

  describe('files:updateTags', () => {
    it('should update file tags', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      const fileResult = db.prepare(`
        INSERT INTO files (tool_id, path) VALUES (?, ?)
      `).run(toolId, '/path/to/file.txt');
      const fileId = Number(fileResult.lastInsertRowid);

      const result = await handlers['files:updateTags']({}, fileId, 'tag1, tag2');
      
      expect(result).toEqual({ ok: true });
      
      const file = db.prepare('SELECT tags FROM files WHERE id = ?').get(fileId);
      expect(file.tags).toBe('tag1, tag2');
    });
  });

  describe('files:delete', () => {
    it('should delete file from database', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      const fileResult = db.prepare(`
        INSERT INTO files (tool_id, path) VALUES (?, ?)
      `).run(toolId, '/path/to/file.txt');
      const fileId = Number(fileResult.lastInsertRowid);

      const result = await handlers['files:delete']({}, fileId, false);
      
      expect(result).toEqual({ ok: true });
      
      const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
      expect(file).toBeUndefined();
    });

    it('should delete file from disk when deleteDiskFile is true', async () => {
      const mockFs = await import('node:fs/promises');
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      const filePath = '/path/to/file.txt';
      const fileResult = db.prepare(`
        INSERT INTO files (tool_id, path) VALUES (?, ?)
      `).run(toolId, filePath);
      const fileId = Number(fileResult.lastInsertRowid);

      mockFs.unlink = vi.fn().mockResolvedValue(undefined);

      const result = await handlers['files:delete']({}, fileId, true);
      
      expect(result).toEqual({ ok: true });
      expect(mockFs.unlink).toHaveBeenCalledWith(filePath);
    });

    it('should throw error when file not found', async () => {
      await expect(
        handlers['files:delete']({}, 99999, false)
      ).rejects.toThrow('File not found');
    });
  });

  describe('files:showInFolder', () => {
    it('should show file in folder and record recent', async () => {
      const { shell } = await import('electron');
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      const filePath = '/path/to/file.txt';
      const fileResult = db.prepare(`
        INSERT INTO files (tool_id, path) VALUES (?, ?)
      `).run(toolId, filePath);
      const fileId = Number(fileResult.lastInsertRowid);

      const result = await handlers['files:showInFolder']({}, filePath);
      
      expect(result).toEqual({ ok: true });
      expect(shell.showItemInFolder).toHaveBeenCalledWith(filePath);
      
      const recent = db.prepare('SELECT * FROM recent WHERE kind = ? AND ref_id = ?').get('file', fileId);
      expect(recent).toBeDefined();
    });
  });

  describe('files:openInApp', () => {
    it('should open file in app and record recent', async () => {
      const { shell } = await import('electron');
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      const filePath = '/path/to/file.txt';
      const fileResult = db.prepare(`
        INSERT INTO files (tool_id, path) VALUES (?, ?)
      `).run(toolId, filePath);
      const fileId = Number(fileResult.lastInsertRowid);

      shell.openPath = vi.fn().mockResolvedValue('');

      const result = await handlers['files:openInApp']({}, filePath);
      
      expect(result).toEqual({ ok: true });
      expect(shell.openPath).toHaveBeenCalledWith(filePath);
      
      const recent = db.prepare('SELECT * FROM recent WHERE kind = ? AND ref_id = ?').get('file', fileId);
      expect(recent).toBeDefined();
    });
  });

  describe('files:openFolder', () => {
    it('should open files folder', async () => {
      const { shell } = await import('electron');
      const toolResult = db.prepare(`
        INSERT INTO tools (name, files_folder) VALUES (?, ?)
      `).run('Test Tool', os.tmpdir());
      const toolId = Number(toolResult.lastInsertRowid);

      shell.openPath = vi.fn().mockResolvedValue('');

      const result = await handlers['files:openFolder']({}, toolId);
      
      expect(result).toEqual({ ok: true });
      expect(shell.openPath).toHaveBeenCalledWith(os.tmpdir());
    });
  });

  describe('recent:list', () => {
    it('should return recent items for a tool', async () => {
      const mockFs = await import('node:fs/promises');
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);
      
      // Create a prompt
      const promptResult = db.prepare(`
        INSERT INTO prompts (tool_id, title, content) VALUES (?, ?, ?)
      `).run(toolId, 'Test Prompt', 'Content');
      const promptId = Number(promptResult.lastInsertRowid);
      
      // Record recent usage
      db.prepare(`
        INSERT INTO recent (kind, ref_id, last_used_at) VALUES (?, ?, datetime('now'))
      `).run('prompt', promptId);

      mockFs.stat = vi.fn().mockRejectedValue(new Error('File not found'));

      const result = await handlers['recent:list']({}, toolId);
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('kind');
      expect(result[0]).toHaveProperty('refId');
    });

    it('should return empty array when no recent items', async () => {
      const toolResult = db.prepare(`
        INSERT INTO tools (name) VALUES (?)
      `).run('Test Tool');
      const toolId = Number(toolResult.lastInsertRowid);

      const mockFs = await import('node:fs/promises');
      mockFs.stat = vi.fn().mockRejectedValue(new Error('File not found'));

      const result = await handlers['recent:list']({}, toolId);
      
      expect(result).toEqual([]);
    });
  });
});

