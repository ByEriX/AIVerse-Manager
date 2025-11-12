import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolForm from '../../app/renderer/src/components/ToolForm.jsx';

// Mock window.aiverse API
const mockAiverse = {
  open: {
    selectFolder: vi.fn(() => Promise.resolve('/selected/folder')),
    selectFile: vi.fn(() => Promise.resolve('/selected/file.png'))
  },
  file: {
    saveTemplateIcon: vi.fn(() => Promise.resolve('/saved/icon.png'))
  }
};

beforeEach(() => {
  global.window.aiverse = mockAiverse;
  vi.clearAllMocks();
});

describe('ToolForm Component', () => {
  it('should render new tool form', () => {
    render(<ToolForm onSave={vi.fn()} onCancel={vi.fn()} />);
    
    expect(screen.getByText('New Tool')).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/local executable/i)).toBeInTheDocument();
  });

  it('should render edit tool form when tool prop is provided', () => {
    const tool = {
      id: 1,
      name: 'Existing Tool',
      appUrl: 'https://example.com',
      docsUrl: 'https://docs.example.com'
    };
    
    render(<ToolForm tool={tool} onSave={vi.fn()} onCancel={vi.fn()} />);
    
    expect(screen.getByText('Edit Tool')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Tool')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
  });

  it('should validate name is required', async () => {
    const onSave = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    render(<ToolForm onSave={onSave} onCancel={vi.fn()} />);
    
    const saveButton = screen.getByText('Create');
    await userEvent.click(saveButton);
    
    expect(alertSpy).toHaveBeenCalledWith('Tool name is required');
    expect(onSave).not.toHaveBeenCalled();
    
    alertSpy.mockRestore();
  });

  it('should call onSave with correct payload', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    
    render(<ToolForm onSave={onSave} onCancel={vi.fn()} />);
    
    await user.type(screen.getByLabelText(/name/i), 'Test Tool');
    await user.type(screen.getByLabelText(/Documentation/i), 'https://docs.com');
    
    const saveButton = screen.getByText('Create');
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: 'Test Tool',
        docsUrl: 'https://docs.com',
        appUrl: undefined,
        execPath: undefined,
        iconPath: undefined,
        imagesFolder: undefined,
        filesFolder: undefined
      });
    });
  });

  it('should show exec path field when isLocal is checked', async () => {
    const user = userEvent.setup();
    render(<ToolForm onSave={vi.fn()} onCancel={vi.fn()} />);
    
    const localCheckbox = screen.getByLabelText(/local executable/i);
    await user.click(localCheckbox);
    
    expect(screen.getByLabelText(/Executable Path/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/App URL/i)).not.toBeInTheDocument();
  });

  it('should show app URL field when isLocal is unchecked', () => {
    render(<ToolForm onSave={vi.fn()} onCancel={vi.fn()} />);
    
    expect(screen.getByLabelText(/App URL/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Executable Path/i)).not.toBeInTheDocument();
  });

  it('should handle folder selection', async () => {
    const user = userEvent.setup();
    render(<ToolForm onSave={vi.fn()} onCancel={vi.fn()} />);
    
    const browseButtons = screen.getAllByText('Browse');
    const imagesFolderButton = browseButtons[1]; // Images folder browse button
    
    await user.click(imagesFolderButton);
    
    expect(mockAiverse.open.selectFolder).toHaveBeenCalled();
  });

  it('should handle file selection for icon', async () => {
    const user = userEvent.setup();
    render(<ToolForm onSave={vi.fn()} onCancel={vi.fn()} />);
    
    const browseButtons = screen.getAllByText('Browse');
    const iconBrowseButton = browseButtons[0]; // Icon browse button
    
    await user.click(iconBrowseButton);
    
    expect(mockAiverse.open.selectFile).toHaveBeenCalledWith({
      defaultPath: '',
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'ico', 'svg', 'webp'] }
      ]
    });
  });

  it('should show delete button only when editing existing tool', () => {
    const onDelete = vi.fn();
    
    // New tool - no delete button
    const { rerender } = render(<ToolForm onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText('Delete Tool')).not.toBeInTheDocument();
    
    // Existing tool - has delete button
    rerender(
      <ToolForm 
        tool={{ id: 1, name: 'Test' }} 
        onSave={vi.fn()} 
        onCancel={vi.fn()} 
        onDelete={onDelete} 
      />
    );
    expect(screen.getByText('Delete Tool')).toBeInTheDocument();
  });

  it('should confirm before deleting', async () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    
    render(
      <ToolForm 
        tool={{ id: 1, name: 'Test Tool' }} 
        onSave={vi.fn()} 
        onCancel={vi.fn()} 
        onDelete={onDelete} 
      />
    );
    
    const deleteButton = screen.getByText('Delete Tool');
    await user.click(deleteButton);
    
    expect(confirmSpy).toHaveBeenCalledWith('Delete "Test Tool"? This cannot be undone.');
    expect(onDelete).toHaveBeenCalled();
    
    confirmSpy.mockRestore();
  });

  it('should not delete if confirmation is cancelled', async () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    
    render(
      <ToolForm 
        tool={{ id: 1, name: 'Test Tool' }} 
        onSave={vi.fn()} 
        onCancel={vi.fn()} 
        onDelete={onDelete} 
      />
    );
    
    const deleteButton = screen.getByText('Delete Tool');
    await user.click(deleteButton);
    
    expect(onDelete).not.toHaveBeenCalled();
    
    confirmSpy.mockRestore();
  });

  it('should show templates section for new tools', () => {
    render(<ToolForm onSave={vi.fn()} onCancel={vi.fn()} />);
    
    expect(screen.getByText('Apply a Template')).toBeInTheDocument();
  });

  it('should not show templates section for existing tools', () => {
    render(
      <ToolForm 
        tool={{ id: 1, name: 'Test' }} 
        onSave={vi.fn()} 
        onCancel={vi.fn()} 
      />
    );
    
    expect(screen.queryByText('Apply a Template')).not.toBeInTheDocument();
  });
});

