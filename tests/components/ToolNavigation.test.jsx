import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToolNavigation from '../../app/renderer/src/components/ToolNavigation.jsx';

// Helper to render with route
const renderWithRoute = (path) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tool/:id/*" element={<ToolNavigation />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ToolNavigation', () => {
  it('should render navigation links for a tool', () => {
    renderWithRoute('/tool/1');

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Prompts')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('should return null when no id in params', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<ToolNavigation />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
  });

  it('should highlight Overview link when on overview page', () => {
    renderWithRoute('/tool/1');

    const overviewLink = screen.getByText('Overview').closest('a');
    expect(overviewLink).toHaveStyle({ borderBottom: expect.stringContaining('2px solid') });
  });

  it('should highlight Prompts link when on prompts page', () => {
    renderWithRoute('/tool/1/prompts');

    const promptsLink = screen.getByText('Prompts').closest('a');
    expect(promptsLink).toHaveStyle({ borderBottom: expect.stringContaining('2px solid') });
  });

  it('should highlight Images link when on images page', () => {
    renderWithRoute('/tool/1/images');

    const imagesLink = screen.getByText('Images').closest('a');
    expect(imagesLink).toHaveStyle({ borderBottom: expect.stringContaining('2px solid') });
  });

  it('should highlight Files link when on files page', () => {
    renderWithRoute('/tool/1/files');

    const filesLink = screen.getByText('Files').closest('a');
    expect(filesLink).toHaveStyle({ borderBottom: expect.stringContaining('2px solid') });
  });

  it('should have correct href attributes', () => {
    renderWithRoute('/tool/1');

    expect(screen.getByText('Overview').closest('a')).toHaveAttribute('href', '/tool/1');
    expect(screen.getByText('Prompts').closest('a')).toHaveAttribute('href', '/tool/1/prompts');
    expect(screen.getByText('Images').closest('a')).toHaveAttribute('href', '/tool/1/images');
    expect(screen.getByText('Files').closest('a')).toHaveAttribute('href', '/tool/1/files');
  });
});

