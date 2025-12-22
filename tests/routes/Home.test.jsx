import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from '../../app/renderer/src/routes/Home.jsx';

// Mock window.aiverse API
const mockAiverse = {
  tools: {
    list: vi.fn(() => Promise.resolve([])),
    onChanged: vi.fn(() => vi.fn()),
    export: vi.fn(() => Promise.resolve({ ok: true, filePath: '/test/export.zip', stats: { tools: 1, prompts: 0 } })),
    import: vi.fn(() => Promise.resolve({ ok: true, stats: { tools: { created: 1 } } }))
  },
  file: {
    readAsDataUrl: vi.fn(() => Promise.resolve('data:image/png;base64,test'))
  }
};

beforeEach(() => {
  global.window.aiverse = mockAiverse;
  vi.clearAllMocks();
  // Mock window.confirm and alert
  global.window.confirm = vi.fn(() => true);
  global.window.alert = vi.fn();
});

const renderHome = () => {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
};

describe('Home Component', () => {
  it('should render home page with title', () => {
    renderHome();
    expect(screen.getByText('Your Tools')).toBeInTheDocument();
    expect(screen.getByText('Manage your AI tools, prompts, images, and files')).toBeInTheDocument();
  });

  it('should load and display tools', async () => {
    const mockTools = [
      { id: 1, name: 'Tool 1', appUrl: 'https://tool1.com' },
      { id: 2, name: 'Tool 2', appUrl: 'https://tool2.com' }
    ];
    mockAiverse.tools.list.mockResolvedValue(mockTools);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Tool 1')).toBeInTheDocument();
      expect(screen.getByText('Tool 2')).toBeInTheDocument();
    });
  });

  it('should show "New Tool" button', () => {
    renderHome();
    const newToolLinks = screen.getAllByText('New Tool');
    expect(newToolLinks.length).toBeGreaterThan(0);
    expect(newToolLinks[0].closest('a')).toHaveAttribute('href', '/tool/new');
  });

  it('should disable export button when no tools exist', () => {
    mockAiverse.tools.list.mockResolvedValue([]);
    renderHome();
    
    const exportButton = screen.getByText('Export');
    expect(exportButton).toBeDisabled();
  });

  it('should enable export button when tools exist', async () => {
    const mockTools = [{ id: 1, name: 'Tool 1' }];
    mockAiverse.tools.list.mockResolvedValue(mockTools);

    renderHome();

    await waitFor(() => {
      const exportButton = screen.getByText('Export');
      expect(exportButton).not.toBeDisabled();
    });
  });

  it('should open export dialog when export button is clicked', async () => {
    const user = userEvent.setup();
    const mockTools = [{ id: 1, name: 'Tool 1' }];
    mockAiverse.tools.list.mockResolvedValue(mockTools);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Tool 1')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export');
    await user.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText(/Export Tool Data/i)).toBeInTheDocument();
    });
  });

  it('should open import dialog when import button is clicked', async () => {
    const user = userEvent.setup();
    renderHome();

    const importButton = screen.getByText('Import');
    await user.click(importButton);

    await waitFor(() => {
      expect(screen.getByText(/Import Tools/i)).toBeInTheDocument();
    });
  });

  it('should handle tool click and navigate', async () => {
    const mockTools = [{ id: 1, name: 'Tool 1', appUrl: 'https://tool1.com' }];
    mockAiverse.tools.list.mockResolvedValue(mockTools);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Tool 1')).toBeInTheDocument();
    });

    // Check for "View Details" link instead
    const viewDetailsLink = screen.getByText('View Details');
    expect(viewDetailsLink.closest('a')).toHaveAttribute('href', '/tool/1');
  });

  it('should refresh tools when tools:changed event fires', async () => {
    const mockTools = [{ id: 1, name: 'Tool 1' }];
    mockAiverse.tools.list.mockResolvedValue(mockTools);
    
    let changeCallback;
    mockAiverse.tools.onChanged.mockImplementation((callback) => {
      changeCallback = callback;
      return vi.fn();
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Tool 1')).toBeInTheDocument();
    });

    // Simulate tools changed event
    const updatedTools = [{ id: 1, name: 'Updated Tool' }];
    mockAiverse.tools.list.mockResolvedValue(updatedTools);
    
    if (changeCallback) {
      changeCallback();
    }

    await waitFor(() => {
      expect(screen.getByText('Updated Tool')).toBeInTheDocument();
    });
  });

  it('should handle export with options', async () => {
    const user = userEvent.setup();
    const mockTools = [{ id: 1, name: 'Tool 1' }];
    mockAiverse.tools.list.mockResolvedValue(mockTools);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Tool 1')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export');
    await user.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText(/Export Tool Data/i)).toBeInTheDocument();
    });

    // Check export options checkboxes exist
    const includeFilesCheckbox = screen.getByLabelText(/Include files/i);
    const includeImagesCheckbox = screen.getByLabelText(/Include images/i);
    
    expect(includeFilesCheckbox).toBeInTheDocument();
    expect(includeImagesCheckbox).toBeInTheDocument();
  });
});

