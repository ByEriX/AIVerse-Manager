import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ToolIcon from '../../app/renderer/src/components/ToolIcon.jsx';

// Mock window.aiverse API
const mockAiverse = {
  file: {
    readAsDataUrl: vi.fn(() => Promise.resolve('data:image/png;base64,test'))
  }
};

beforeEach(() => {
  global.window.aiverse = mockAiverse;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ToolIcon Component', () => {
  it('should render placeholder when no iconPath', () => {
    const { container } = render(<ToolIcon />);
    const placeholder = container.querySelector('div');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('should render data URL directly', () => {
    const dataUrl = 'data:image/png;base64,test123';
    render(<ToolIcon iconPath={dataUrl} />);
    
    const img = screen.getByAltText('Tool icon');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', dataUrl);
  });

  it('should render HTTP URL directly', () => {
    const httpUrl = 'https://example.com/icon.png';
    render(<ToolIcon iconPath={httpUrl} />);
    
    const img = screen.getByAltText('Tool icon');
    expect(img).toHaveAttribute('src', httpUrl);
  });

  it('should render bundled asset URL directly', () => {
    const assetUrl = '/assets/templates/icons/chatgpt.png';
    render(<ToolIcon iconPath={assetUrl} />);
    
    const img = screen.getByAltText('Tool icon');
    expect(img).toHaveAttribute('src', assetUrl);
  });

  it('should load filesystem path as data URL', async () => {
    const filePath = '/path/to/icon.png';
    mockAiverse.file.readAsDataUrl.mockResolvedValue('data:image/png;base64,loaded');
    
    render(<ToolIcon iconPath={filePath} />);
    
    await waitFor(() => {
      expect(mockAiverse.file.readAsDataUrl).toHaveBeenCalledWith(filePath);
    });
    
    await waitFor(() => {
      const img = screen.getByAltText('Tool icon');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,loaded');
    });
  });

  it('should handle loading error gracefully', async () => {
    const filePath = '/nonexistent/icon.png';
    mockAiverse.file.readAsDataUrl.mockRejectedValue(new Error('File not found'));
    
    const { container } = render(<ToolIcon iconPath={filePath} />);
    
    await waitFor(() => {
      expect(mockAiverse.file.readAsDataUrl).toHaveBeenCalled();
    });
    
    // Should show placeholder after error
    await waitFor(() => {
      const placeholder = container.querySelector('div');
      expect(placeholder).toBeInTheDocument();
      expect(screen.queryByAltText('Tool icon')).not.toBeInTheDocument();
    });
  });

  it('should respect size prop', () => {
    const { container } = render(<ToolIcon size={48} />);
    
    const placeholder = container.querySelector('div[style*="width: 48px"]');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveStyle({ width: '48px', height: '48px' });
  });

  it('should update when iconPath changes', async () => {
    const { rerender } = render(<ToolIcon iconPath="/old/path.png" />);
    
    await waitFor(() => {
      expect(mockAiverse.file.readAsDataUrl).toHaveBeenCalledWith('/old/path.png');
    });
    
    vi.clearAllMocks();
    mockAiverse.file.readAsDataUrl.mockResolvedValue('data:image/png;base64,new');
    
    rerender(<ToolIcon iconPath="/new/path.png" />);
    
    await waitFor(() => {
      expect(mockAiverse.file.readAsDataUrl).toHaveBeenCalledWith('/new/path.png');
    });
  });
});

