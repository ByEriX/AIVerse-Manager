import { vi } from 'vitest';

// Mock Electron APIs for testing
export const mockElectron = {
  app: {
    getPath: vi.fn((name) => {
      if (name === 'userData') {
        return '/tmp/test-user-data';
      }
      return '/tmp/test-path';
    })
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    fromWebContents: vi.fn(() => ({
      webContents: {
        send: vi.fn()
      }
    }))
  },
  dialog: {
    showOpenDialog: vi.fn(() => Promise.resolve({
      canceled: false,
      filePaths: ['/tmp/test-file']
    }))
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(() => Promise.resolve('')),
    showItemInFolder: vi.fn()
  },
  ipcMain: {
    handle: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn((channel, ...args) => Promise.resolve({})),
    on: vi.fn(() => vi.fn()),
    removeListener: vi.fn()
  },
  contextBridge: {
    exposeInMainWorld: vi.fn()
  }
};

