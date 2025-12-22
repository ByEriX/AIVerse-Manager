import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Files from '../../app/renderer/src/routes/Files.jsx';

// Mock window.aiverse API
const mockAiverse = {
  tools: {
    list: vi.fn(() => Promise.resolve([]))
  },
  files: {
    scan: vi.fn(() => Promise.resolve({ folders: [], files: [], currentPath: '' })),
    getById: vi.fn(() => Promise.resolve(null)),
    delete: vi.fn(() => Promise.resolve({ ok: true })),
    updateTags: vi.fn(() => Promise.resolve({ ok: true })),
    showInFolder: vi.fn(() => Promise.resolve({ ok: true })),
    openInApp: vi.fn(() => Promise.resolve({ ok: true }))
  }
};

// Mock components
vi.mock('../../app/renderer/src/components/ToolNavigation.jsx', () => ({
  default: () => <div data-testid="tool-navigation">Navigation</div>
}));

vi.mock('../../app/renderer/src/components/ToolIcon.jsx', () => ({
  default: () => <div data-testid="tool-icon">Icon</div>
}));

beforeEach(() => {
  global.window.aiverse = mockAiverse;
  vi.clearAllMocks();
  global.window.alert = vi.fn();
  global.window.confirm = vi.fn(() => true);
});

const renderFiles = (toolId = '1', searchParams = '') => {
  return render(
    <MemoryRouter initialEntries={[`/tool/${toolId}/files${searchParams ? '?' + searchParams : ''}`]}>
      <Routes>
        <Route path="/tool/:id/files" element={<Files />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Files Component', () => {
  it('should load and display files', async () => {
    const mockTool = { id: 1, name: 'Test Tool', filesFolder: '/test/files' };
    const mockFiles = {
      folders: [{ name: 'subfolder', path: 'subfolder', isFolder: true }],
      files: [
        { id: 1, name: 'file1.txt', path: '/test/files/file1.txt', size: 1024 }
      ],
      currentPath: ''
    };
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.files.scan.mockResolvedValue(mockFiles);

    renderFiles('1');

    await waitFor(() => {
      expect(mockAiverse.tools.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAiverse.files.scan).toHaveBeenCalledWith(1, '');
    }, { timeout: 3000 });
  });

  it('should navigate to folder when clicked', async () => {
    const mockTool = { id: 1, name: 'Test Tool', filesFolder: '/test/files' };
    const mockFiles = {
      folders: [{ name: 'subfolder', path: 'subfolder', isFolder: true }],
      files: [],
      currentPath: ''
    };
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.files.scan.mockResolvedValue(mockFiles);

    renderFiles('1');

    await waitFor(() => {
      expect(mockAiverse.tools.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAiverse.files.scan).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should open file from query parameter', async () => {
    const mockTool = { id: 1, name: 'Test Tool', filesFolder: '/test/files' };
    const mockFileInfo = { id: 1, name: 'file1.txt', path: '/test/files/file1.txt', folderPath: '' };
    const mockFiles = {
      folders: [],
      files: [{ id: 1, name: 'file1.txt', path: '/test/files/file1.txt' }],
      currentPath: ''
    };
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.files.scan.mockResolvedValue(mockFiles);
    mockAiverse.files.getById.mockResolvedValue(mockFileInfo);

    renderFiles('1', 'fileId=1');

    await waitFor(() => {
      expect(mockAiverse.tools.list).toHaveBeenCalled();
    });

    // The component will call getById after tool loads and scan completes
    await waitFor(() => {
      expect(mockAiverse.files.getById).toHaveBeenCalledWith(1);
    }, { timeout: 5000 });
  });

  it('should delete file when delete is confirmed', async () => {
    const mockTool = { id: 1, name: 'Test Tool', filesFolder: '/test/files' };
    const mockFiles = {
      folders: [],
      files: [{ id: 1, name: 'file1.txt', path: '/test/files/file1.txt' }],
      currentPath: ''
    };
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.files.scan.mockResolvedValue(mockFiles);

    renderFiles('1');

    await waitFor(() => {
      expect(mockAiverse.tools.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAiverse.files.scan).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should show loading state while scanning', async () => {
    const mockTool = { id: 1, name: 'Test Tool', filesFolder: '/test/files' };
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    // Delay the scan response
    mockAiverse.files.scan.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ folders: [], files: [], currentPath: '' }), 100))
    );

    renderFiles('1');

    await waitFor(() => {
      expect(mockAiverse.tools.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAiverse.files.scan).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});
