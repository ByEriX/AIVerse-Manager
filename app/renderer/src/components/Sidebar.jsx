import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import ToolIcon from './ToolIcon.jsx';

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { id } = useParams();
  const [tools, setTools] = useState([]);

  useEffect(() => {
    async function loadTools() {
      try {
        const toolsList = await window.aiverse.tools.list();
        setTools(toolsList);
      } catch (error) {
        console.error('Failed to load tools', error);
      }
    }

    loadTools();

    const off = window.aiverse?.tools?.onChanged?.(() => loadTools());
    return () => {
      if (off) off();
    };
  }, []);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isCurrentTool = (toolId) => {
    return id && Number(id) === toolId;
  };

  const isToolSection = (path) => {
    return location.pathname.includes(path);
  };

  return (
    <div
      style={{
        width: collapsed ? 48 : 280,
        height: '100vh',
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 100,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: collapsed ? '12px' : '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 52
        }}
      >
        {!collapsed && (
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            AIVerse
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 4,
            color: 'var(--text-secondary)',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {/* Home */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: collapsed ? '8px 12px' : '8px 16px',
            textDecoration: 'none',
            color: isActive('/') ? 'var(--accent)' : 'var(--text-primary)',
            backgroundColor: isActive('/') ? 'var(--sidebar-active)' : 'transparent',
            transition: 'all 0.15s ease',
            fontSize: 14,
            fontWeight: isActive('/') ? 500 : 400
          }}
        >
          {collapsed && <span style={{ fontSize: 18, width: 20, textAlign: 'center' }}>🏠</span>}
          {!collapsed && <span>Home</span>}
        </Link>

        {/* Divider - always show in collapsed view, show below home when not collapsed */}
        {collapsed ? (
          <div style={{ margin: '8px 12px', height: 1, backgroundColor: 'var(--border)' }} />
        ) : (
          <div style={{ margin: '8px 16px', height: 1, backgroundColor: 'var(--border)' }} />
        )}

        {/* Tools */}
        {!collapsed && (
          <div style={{ padding: '4px 8px 4px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tools
          </div>
        )}

        {tools.map((tool) => {
          const isActiveTool = isCurrentTool(tool.id) || isToolSection(`/tool/${tool.id}`);

          return (
            <Link
              key={tool.id}
              to={`/tool/${tool.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: collapsed ? '8px 12px' : '6px 12px 6px 16px',
                textDecoration: 'none',
                color: isActiveTool ? 'var(--accent)' : 'var(--text-primary)',
                backgroundColor: isActiveTool ? 'var(--sidebar-active)' : 'transparent',
                transition: 'all 0.15s ease',
                fontSize: 14,
                fontWeight: isActiveTool ? 500 : 400,
                borderRadius: collapsed ? 0 : 4
              }}
            >
              <ToolIcon iconPath={tool.iconPath} size={collapsed ? 24 : 20} />
              {!collapsed && <span>{tool.name}</span>}
            </Link>
          );
        })}
      </div>

      {/* New Tool Button */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
        <Link
          to="/tool/new"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: collapsed ? '8px' : '8px 12px',
            textDecoration: 'none',
            color: 'var(--text-secondary)',
            fontSize: 14,
            borderRadius: 6,
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            transition: 'all 0.15s ease',
            justifyContent: collapsed ? 'center' : 'flex-start'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <span style={{ fontSize: 16 }}>+</span>
          {!collapsed && <span>New tool</span>}
        </Link>
      </div>
    </div>
  );
}

