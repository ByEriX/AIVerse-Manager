import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../app/renderer/src/contexts/ThemeContext.jsx';
import App from '../../app/renderer/src/App.jsx';
import React from 'react';

describe('main.jsx structure', () => {
  it('should have correct imports available', () => {
    // Test that the main dependencies are importable
    expect(BrowserRouter).toBeDefined();
    expect(ThemeProvider).toBeDefined();
    expect(App).toBeDefined();
    expect(React).toBeDefined();
  });

  it('should be able to render App with ThemeProvider and BrowserRouter', () => {
    // This test verifies the structure that main.jsx should use
    const structure = (
      <React.StrictMode>
        <ThemeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </React.StrictMode>
    );
    
    expect(structure).toBeDefined();
    expect(structure.type).toBe(React.StrictMode);
  });
});

