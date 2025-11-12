import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Home from './routes/Home.jsx';
import ToolDetails from './routes/ToolDetails.jsx';
import NewTool from './routes/NewTool.jsx';
import Prompts from './routes/Prompts.jsx';
import Images from './routes/Images.jsx';
import Files from './routes/Files.jsx';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: sidebarCollapsed ? 48 : 280, transition: 'margin-left 0.2s ease' }}>
        {/* Top Bar */}
        <header style={{
          height: 52,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          backgroundColor: 'var(--bg-primary)',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <div style={{ flex: 1 }} />
          <button
            onClick={toggleTheme}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              borderRadius: 6,
              fontSize: 18,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              transition: 'color 0.15s ease'
            }}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </header>

        {/* Main Content */}
        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tool/new" element={<NewTool />} />
              <Route path="/tool/:id" element={<ToolDetails />} />
              <Route path="/tool/:id/prompts" element={<Prompts />} />
              <Route path="/tool/:id/images" element={<Images />} />
              <Route path="/tool/:id/files" element={<Files />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}


