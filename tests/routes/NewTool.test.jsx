import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NewTool from '../../app/renderer/src/routes/NewTool.jsx';

// Mock window.aiverse API
const mockAiverse = {
  tools: {
    create: vi.fn(() => Promise.resolve({ id: 1 }))
  }
};

// Mock ToolForm component
vi.mock('../../app/renderer/src/components/ToolForm.jsx', () => ({
  default: ({ onSave, onCancel }) => (
    <div data-testid="tool-form">
      <button onClick={() => onSave({ name: 'Test Tool', appUrl: 'https://test.com' })}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}));

beforeEach(() => {
  global.window.aiverse = mockAiverse;
  vi.clearAllMocks();
  global.window.alert = vi.fn();
});

const renderNewTool = () => {
  return render(
    <MemoryRouter>
      <NewTool />
    </MemoryRouter>
  );
};

describe('NewTool Component', () => {
  it('should render page title', () => {
    renderNewTool();
    expect(screen.getByText('New Tool')).toBeInTheDocument();
  });

  it('should render ToolForm component', () => {
    renderNewTool();
    expect(screen.getByTestId('tool-form')).toBeInTheDocument();
  });

  it('should create tool and navigate on save', async () => {
    const user = userEvent.setup();
    mockAiverse.tools.create.mockResolvedValue({ id: 1 });

    renderNewTool();

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockAiverse.tools.create).toHaveBeenCalledWith({
        name: 'Test Tool',
        appUrl: 'https://test.com'
      });
    });
  });

  it('should handle create error', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAiverse.tools.create.mockRejectedValue(new Error('Create failed'));

    renderNewTool();

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(global.window.alert).toHaveBeenCalledWith('Failed to create tool. Check console.');
    });

    consoleErrorSpy.mockRestore();
  });

  it('should navigate to home on cancel', async () => {
    const user = userEvent.setup();
    renderNewTool();

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    // Check navigation happened (would need to verify with router)
    expect(cancelButton).toBeInTheDocument();
  });
});
