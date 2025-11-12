import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from '../../app/renderer/src/components/Sidebar.jsx';

// Mock window.aiverse API
const mockAiverse = {
  tools: {
    list: vi.fn(() => Promise.resolve([])),
    onChanged: vi.fn(() => vi.fn())
  }
};

beforeEach(() => {
  global.window.aiverse = mockAiverse;
  vi.clearAllMocks();
});

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Sidebar Component', () => {
  it('should render sidebar with title when not collapsed', () => {
    renderWithRouter(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    
    expect(screen.getByText('AIVerse')).toBeInTheDocument();
  });

  it('should not show title when collapsed', () => {
    renderWithRouter(<Sidebar collapsed={true} onToggle={vi.fn()} />);
    
    expect(screen.queryByText('AIVerse')).not.toBeInTheDocument();
  });

  it('should render toggle button', () => {
    renderWithRouter(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    
    const toggleButton = screen.getByTitle('Collapse sidebar');
    expect(toggleButton).toBeInTheDocument();
  });

  it('should call onToggle when toggle button is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    
    renderWithRouter(<Sidebar collapsed={false} onToggle={onToggle} />);
    
    const toggleButton = screen.getByTitle('Collapse sidebar');
    await user.click(toggleButton);
    
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should show Home link', () => {
    renderWithRouter(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    
    const homeLink = screen.getByText('Home');
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('should load and display tools', async () => {
    const mockTools = [
      { id: 1, name: 'Tool 1', iconPath: '/icon1.png' },
      { id: 2, name: 'Tool 2', iconPath: '/icon2.png' }
    ];
    
    mockAiverse.tools.list.mockResolvedValue(mockTools);
    
    // Mock file.readAsDataUrl for ToolIcon component
    mockAiverse.file = {
      readAsDataUrl: vi.fn(() => Promise.resolve('data:image/png;base64,test'))
    };
    
    renderWithRouter(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('Tool 1')).toBeInTheDocument();
      expect(screen.getByText('Tool 2')).toBeInTheDocument();
    });
  });

  it('should show "New tool" button', () => {
    renderWithRouter(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    
    const newToolLink = screen.getByText('New tool');
    expect(newToolLink).toBeInTheDocument();
    expect(newToolLink.closest('a')).toHaveAttribute('href', '/tool/new');
  });

  it('should show collapsed "New tool" button when collapsed', () => {
    renderWithRouter(<Sidebar collapsed={true} onToggle={vi.fn()} />);
    
    const newToolLink = screen.queryByText('New tool');
    expect(newToolLink).not.toBeInTheDocument();
    
    // Plus icon should still be there
    const plusIcon = screen.getByText('+');
    expect(plusIcon).toBeInTheDocument();
  });

  it('should register and cleanup tools changed listener', () => {
    const unsubscribe = vi.fn();
    mockAiverse.tools.onChanged.mockReturnValue(unsubscribe);
    
    const { unmount } = renderWithRouter(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    
    expect(mockAiverse.tools.onChanged).toHaveBeenCalled();
    
    unmount();
    
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should handle errors when loading tools', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAiverse.tools.list.mockRejectedValue(new Error('Failed to load'));
    
    renderWithRouter(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load tools',
        expect.any(Error)
      );
    }, { timeout: 3000 });
    
    consoleErrorSpy.mockRestore();
  });

  it('should show Tools section label when not collapsed', () => {
    renderWithRouter(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('should not show Tools section label when collapsed', () => {
    renderWithRouter(<Sidebar collapsed={true} onToggle={vi.fn()} />);
    
    expect(screen.queryByText('Tools')).not.toBeInTheDocument();
  });
});

