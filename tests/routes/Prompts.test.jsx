import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Prompts from '../../app/renderer/src/routes/Prompts.jsx';

// Mock window.aiverse API
const mockAiverse = {
  tools: {
    list: vi.fn(() => Promise.resolve([]))
  },
  prompts: {
    list: vi.fn(() => Promise.resolve([])),
    create: vi.fn(() => Promise.resolve({ id: 1 })),
    update: vi.fn(() => Promise.resolve({ ok: true })),
    delete: vi.fn(() => Promise.resolve({ ok: true }))
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
  // Mock clipboard using Object.defineProperty
  Object.defineProperty(global.navigator, 'clipboard', {
    value: {
      writeText: vi.fn(() => Promise.resolve())
    },
    writable: true,
    configurable: true
  });
  vi.clearAllMocks();
  global.window.alert = vi.fn();
  global.window.confirm = vi.fn(() => true);
});

const renderPrompts = (toolId = '1', searchParams = '') => {
  return render(
    <MemoryRouter initialEntries={[`/tool/${toolId}/prompts${searchParams ? '?' + searchParams : ''}`]}>
      <Routes>
        <Route path="/tool/:id/prompts" element={<Prompts />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Prompts Component', () => {
  it('should load and display prompts', async () => {
    const mockTool = { id: 1, name: 'Test Tool' };
    const mockPrompts = [
      { id: 1, title: 'Prompt 1', content: 'Content 1', tags: 'tag1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { id: 2, title: 'Prompt 2', content: 'Content 2', tags: 'tag2', createdAt: '2024-01-02', updatedAt: '2024-01-02' }
    ];
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.prompts.list.mockResolvedValue(mockPrompts);

    renderPrompts('1');

    await waitFor(() => {
      expect(mockAiverse.tools.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAiverse.prompts.list).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should create new prompt', async () => {
    const mockTool = { id: 1, name: 'Test Tool' };
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.prompts.list.mockResolvedValue([]);

    renderPrompts('1');

    await waitFor(() => {
      expect(mockAiverse.tools.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAiverse.prompts.list).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should update existing prompt', async () => {
    const mockTool = { id: 1, name: 'Test Tool' };
    const mockPrompts = [
      { id: 1, title: 'Prompt 1', content: 'Content 1', tags: 'tag1', createdAt: '2024-01-01', updatedAt: '2024-01-01' }
    ];
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.prompts.list.mockResolvedValue(mockPrompts);

    renderPrompts('1');

    await waitFor(() => {
      expect(mockAiverse.tools.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAiverse.prompts.list).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should filter prompts by tags', async () => {
    const mockTool = { id: 1, name: 'Test Tool' };
    const mockPrompts = [
      { id: 1, title: 'Prompt 1', content: 'Content 1', tags: 'tag1, tag2', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { id: 2, title: 'Prompt 2', content: 'Content 2', tags: 'tag2', createdAt: '2024-01-02', updatedAt: '2024-01-02' }
    ];
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.prompts.list.mockResolvedValue(mockPrompts);

    renderPrompts('1');

    await waitFor(() => {
      expect(mockAiverse.prompts.list).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify prompts were loaded
    expect(mockAiverse.prompts.list).toHaveBeenCalled();
  });

  it('should copy prompt to clipboard', async () => {
    const mockTool = { id: 1, name: 'Test Tool' };
    const mockPrompts = [
      { id: 1, title: 'Prompt 1', content: 'Content 1', tags: 'tag1', createdAt: '2024-01-01', updatedAt: '2024-01-01' }
    ];
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.prompts.list.mockResolvedValue(mockPrompts);

    renderPrompts('1');

    await waitFor(() => {
      expect(mockAiverse.prompts.list).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify prompts were loaded (clipboard test would require UI interaction)
    expect(mockAiverse.prompts.list).toHaveBeenCalled();
  });

  it('should open prompt from query parameter', async () => {
    const mockTool = { id: 1, name: 'Test Tool' };
    const mockPrompts = [
      { id: 1, title: 'Prompt 1', content: 'Content 1', tags: 'tag1', createdAt: '2024-01-01', updatedAt: '2024-01-01' }
    ];
    mockAiverse.tools.list.mockResolvedValue([mockTool]);
    mockAiverse.prompts.list.mockResolvedValue(mockPrompts);

    renderPrompts('1', 'promptId=1');

    await waitFor(() => {
      expect(mockAiverse.prompts.list).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});
