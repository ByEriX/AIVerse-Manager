import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import ToolForm from '../components/ToolForm.jsx';
import ToolIcon from '../components/ToolIcon.jsx';
import ToolNavigation from '../components/ToolNavigation.jsx';

function RecentImageThumbnail({ path, imageId }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (imageId) {
      window.aiverse.images.getThumbnail(path, imageId)
        .then(url => {
          if (url) {
            setDataUrl(url);
          } else {
            return window.aiverse.file.readAsDataUrl(path);
          }
        })
        .then(url => url && setDataUrl(url))
        .catch(err => console.error('Failed to load thumbnail:', err));
    }
  }, [path, imageId]);

  if (!dataUrl) {
    return (
      <div style={{ width: 60, height: 60, backgroundColor: 'var(--bg-tertiary)', borderRadius: 4, flexShrink: 0 }} />
    );
  }

  return (
    <img
      src={dataUrl}
      style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
      alt="Thumbnail"
    />
  );
}

export default function ToolDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toolId = useMemo(() => Number(id), [id]);
  const [tool, setTool] = useState(null);
  const [editing, setEditing] = useState(false);
  const [recent, setRecent] = useState([]);

  // Check if we should open in manage mode
  useEffect(() => {
    if (location.state?.manage) {
      setEditing(true);
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  async function refresh() {
    const ts = await window.aiverse.tools.list();
    setTool(ts.find((t) => t.id === toolId) ?? null);
  }

  useEffect(() => {
    refresh();
  }, [toolId]);

  useEffect(() => {
    async function loadRecent() {
      if (!toolId) return;
      try {
        const items = await window.aiverse.recent.list(toolId);
        setRecent(items);
      } catch (e) {
        console.error('Failed to load recent', e);
      }
    }
    loadRecent();
    const off = window.aiverse?.recent?.onChanged?.(() => loadRecent());
    return () => {
      if (off) off();
    };
  }, [toolId]);

  async function handleUpdate(payload) {
    try {
      await window.aiverse.tools.update(tool.id, payload);
      await refresh();
      setEditing(false);
    } catch (e) {
      console.error(e);
      alert('Failed to update tool. Check console.');
    }
  }

  async function handleDelete() {
    try {
      await window.aiverse.tools.delete(tool.id);
      navigate('/');
    } catch (e) {
      console.error(e);
      alert('Failed to delete tool. Check console.');
    }
  }

  if (!tool) return null;

  return (
    <div>
      {editing ? (
        <div style={{ maxWidth: 600 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 24px 0' }}>Manage Tool</h1>
          <ToolForm tool={tool} onSave={handleUpdate} onCancel={() => setEditing(false)} onDelete={handleDelete} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ToolIcon iconPath={tool.iconPath} size={48} />
              <div>
                <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0' }}>{tool.name}</h1>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {tool.appUrl && (
                    <button
                      onClick={() => window.aiverse.open.url(tool.appUrl)}
                      style={{
                        padding: '8px 16px',
                        fontSize: 14,
                        fontWeight: 500,
                        borderRadius: 6,
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                    >
                      Open App
                    </button>
                  )}
                  {tool.docsUrl && (
                    <a 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); window.aiverse.open.url(tool.docsUrl); }}
                      style={{
                        fontSize: 14,
                        color: 'var(--accent)',
                        fontWeight: 500,
                        textDecoration: 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                    >
                      Documentation
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setEditing(true)}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              Manage
            </button>
          </div>

          <ToolNavigation />

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px 0' }}>Recent Activity</h2>
            {recent.length === 0 ? (
              <div style={{
                padding: '32px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>No recent activity</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {recent.map((item) => (
                  <div 
                    key={`${item.kind}-${item.refId}-${item.lastUsedAt}`} 
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 16,
                      backgroundColor: 'var(--bg-secondary)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Thumbnail for images */}
                    {item.kind === 'image' && item.imageId && (
                      <RecentImageThumbnail path={item.path} imageId={item.imageId} />
                    )}
                    
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: 11, 
                          color: 'var(--text-tertiary)', 
                          textTransform: 'uppercase', 
                          fontWeight: 600,
                          letterSpacing: '0.5px'
                        }}>
                          {item.kind}
                        </span>
                        <div style={{ 
                          fontWeight: 600, 
                          fontSize: 15,
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 200
                        }}>
                          {item.title || item.name || item.path}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                          {new Date(item.lastUsedAt).toLocaleString()}
                        </div>
                      </div>
                      
                      {/* Prompt content preview */}
                      {item.kind === 'prompt' && item.content && (
                        <div style={{ 
                          fontSize: 13, 
                          color: 'var(--text-secondary)', 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          marginTop: 4,
                          lineHeight: 1.5
                        }}>
                          {item.content}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {item.kind === 'image' && (
                        <>
                          <button 
                            onClick={() => window.aiverse.images.openInViewer(item.path)} 
                            style={{ fontSize: 13, padding: '6px 12px' }}
                          >
                            Open
                          </button>
                          <button 
                            onClick={() => navigate(`/tool/${tool.id}/images?imageId=${item.refId}`)} 
                            style={{ fontSize: 13, padding: '6px 12px' }}
                          >
                            Details
                          </button>
                        </>
                      )}
                      {item.kind === 'file' && (
                        <>
                          <button 
                            onClick={() => window.aiverse.files.openInApp(item.path)} 
                            style={{ fontSize: 13, padding: '6px 12px' }}
                          >
                            Open
                          </button>
                          <button 
                            onClick={() => navigate(`/tool/${tool.id}/files?fileId=${item.refId}`)} 
                            style={{ fontSize: 13, padding: '6px 12px' }}
                          >
                            Details
                          </button>
                        </>
                      )}
                      {item.kind === 'prompt' && (
                        <>
                          <button 
                            onClick={() => navigate(`/tool/${tool.id}/prompts`)} 
                            style={{ fontSize: 13, padding: '6px 12px' }}
                          >
                            Open
                          </button>
                          <button 
                            onClick={() => navigate(`/tool/${tool.id}/prompts?promptId=${item.refId}`)} 
                            style={{ fontSize: 13, padding: '6px 12px' }}
                          >
                            Details
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}


