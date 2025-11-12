import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ToolIcon from '../components/ToolIcon.jsx';

export default function Home() {
  const [tools, setTools] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    window.aiverse.tools.list().then(setTools).catch(console.error);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Your Tools</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Manage your AI tools, prompts, images, and files</p>
        </div>
        <Link
          to="/tool/new"
          style={{
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 500,
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            height: 'fit-content'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
        >
          New Tool
        </Link>
      </div>

      {tools.length === 0 ? (
        <div style={{ 
          padding: '48px 24px', 
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 8,
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>No tools yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 16px 0' }}>Add your first tool to get started</p>
          <Link
            to="/tool/new"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
          >
            New Tool
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {tools.map((t) => (
            <div
              key={t.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 20,
                backgroundColor: 'var(--bg-secondary)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* First row: Icon, Name, Open Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <ToolIcon iconPath={t.iconPath} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      console.log('Opening tool:', t.id, 'execPath:', t.execPath, 'appUrl:', t.appUrl);
                      await window.aiverse.tools.open(t.id);
                    } catch (err) {
                      console.error('Failed to open tool:', err);
                      console.error('Tool data:', t);
                      alert(`Failed to open tool "${t.name}": ${err.message || err}. Check console for details.`);
                    }
                  }}
                  style={{
                    padding: '6px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                >
                  Open
                </button>
              </div>
              
              {/* Second row: View Details and Manage buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <Link
                  to={`/tool/${t.id}`}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    textDecoration: 'none',
                    textAlign: 'center',
                    transition: 'all 0.15s ease'
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
                  View Details
                </Link>
                <button
                  onClick={() => navigate(`/tool/${t.id}`, { state: { manage: true } })}
                  style={{
                    padding: '8px 12px',
                    fontSize: 13,
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  title="Manage Tool"
                >
                  ⚙
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


