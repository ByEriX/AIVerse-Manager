import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../app/renderer/src/App.jsx';
import { ThemeProvider } from '../../app/renderer/src/contexts/ThemeContext.jsx';

// Mock Sidebar and route components
vi.mock('../../app/renderer/src/components/Sidebar.jsx', () => ({
  default: ({ collapsed, onToggle }) => (
    <div data-testid="sidebar" data-collapsed={collapsed}>
      <button onClick={onToggle}>Toggle Sidebar</button>
    </div>
  )
}));

vi.mock('../../app/renderer/src/routes/Home.jsx', () => ({
  default: () => <div>Home Page</div>
}));

vi.mock('../../app/renderer/src/routes/ToolDetails.jsx', () => ({
  default: () => <div>Tool Details</div>
}));

vi.mock('../../app/renderer/src/routes/NewTool.jsx', () => ({
  default: () => <div>New Tool</div>
}));

vi.mock('../../app/renderer/src/routes/Prompts.jsx', () => ({
  default: () => <div>Prompts</div>
}));

vi.mock('../../app/renderer/src/routes/Images.jsx', () => ({
  default: () => <div>Images</div>
}));

vi.mock('../../app/renderer/src/routes/Files.jsx', () => ({
  default: () => <div>Files</div>
}));

const renderApp = (initialEntries = ['/']) => {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render sidebar', () => {
    renderApp();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('should render theme toggle button', () => {
    renderApp();
    const themeButton = screen.getByTitle(/Switch to/);
    expect(themeButton).toBeInTheDocument();
  });

  it('should toggle sidebar when button is clicked', async () => {
    const { waitFor } = await import('@testing-library/react');
    renderApp();
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    
    const toggleButton = screen.getByText('Toggle Sidebar');
    toggleButton.click();
    
    await waitFor(() => {
      expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    });
  });

  it('should render Home route', () => {
    renderApp(['/']);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('should render NewTool route', () => {
    renderApp(['/tool/new']);
    expect(screen.getByText('New Tool')).toBeInTheDocument();
  });

  it('should render ToolDetails route', () => {
    renderApp(['/tool/1']);
    expect(screen.getByText('Tool Details')).toBeInTheDocument();
  });

  it('should render Prompts route', () => {
    renderApp(['/tool/1/prompts']);
    expect(screen.getByText('Prompts')).toBeInTheDocument();
  });

  it('should render Images route', () => {
    renderApp(['/tool/1/images']);
    expect(screen.getByText('Images')).toBeInTheDocument();
  });

  it('should render Files route', () => {
    renderApp(['/tool/1/files']);
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('should toggle theme when theme button is clicked', async () => {
    const { waitFor } = await import('@testing-library/react');
    renderApp();
    const themeButton = screen.getByTitle(/Switch to/);
    
    // Initially light theme
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    
    themeButton.click();
    
    // Should be dark theme
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    
    themeButton.click();
    
    // Should be light theme again
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });
});

