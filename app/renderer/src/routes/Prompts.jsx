import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import ToolNavigation from '../components/ToolNavigation.jsx';
import ToolIcon from '../components/ToolIcon.jsx';

export default function Prompts() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const toolId = Number(id);
  const [tool, setTool] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [sortBy, setSortBy] = useState('updated'); // 'updated', 'created', 'title'
  const [sortDesc, setSortDesc] = useState(true); // true = descending, false = ascending
  const [filterTags, setFilterTags] = useState([]); // array of selected tags
  const [filterMode, setFilterMode] = useState('AND'); // 'AND' or 'OR'

  async function refresh() {
    const tools = await window.aiverse.tools.list();
    setTool(tools.find(t => t.id === toolId) || null);
    const rows = await window.aiverse.prompts.list(toolId);
    setPrompts(rows);
  }

  useEffect(() => {
    refresh();
  }, [toolId]);

  // Open specific prompt from query param
  useEffect(() => {
    const promptIdParam = searchParams.get('promptId');
    if (promptIdParam && prompts.length > 0) {
      const promptId = Number(promptIdParam);
      const prompt = prompts.find(p => p.id === promptId);
      if (prompt) {
        startEdit(prompt);
        // Clear query param
        setSearchParams({}, { replace: true });
      }
    }
  }, [prompts, searchParams]);

  async function onSave() {
    if (editing) {
      await window.aiverse.prompts.update(editing.id, { title, content, tags });
    } else {
      await window.aiverse.prompts.create(toolId, { title, content, tags });
    }
    setEditing(null);
    setTitle('');
    setContent('');
    setTags('');
    refresh();
  }

  function startEdit(p) {
    setEditing(p);
    setTitle(p.title);
    setContent(p.content);
    setTags(p.tags || '');
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }

  const allTags = useMemo(() => {
    const tagSet = new Set();
    prompts.forEach(p => {
      if (p.tags) {
        p.tags.split(',').forEach(t => tagSet.add(t.trim()));
      }
    });
    return Array.from(tagSet).sort();
  }, [prompts]);

  const filteredAndSorted = useMemo(() => {
    let filtered = prompts;
    if (filterTags.length > 0) {
      filtered = prompts.filter(p => {
        if (!p.tags) return false;
        const promptTags = p.tags.split(',').map(t => t.trim());
        if (filterMode === 'AND') {
          return filterTags.every(tag => promptTags.includes(tag));
        } else {
          return filterTags.some(tag => promptTags.includes(tag));
        }
      });
    }
    const sorted = [...filtered];
    if (sortBy === 'updated') {
      sorted.sort((a, b) => sortDesc ? b.updatedAt.localeCompare(a.updatedAt) : a.updatedAt.localeCompare(b.updatedAt));
    } else if (sortBy === 'created') {
      sorted.sort((a, b) => sortDesc ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt));
    } else if (sortBy === 'title') {
      sorted.sort((a, b) => sortDesc ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title));
    }
    return sorted;
  }, [prompts, sortBy, sortDesc, filterTags, filterMode]);

  if (!tool) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ToolIcon iconPath={tool.iconPath} size={48} />
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0' }}>Prompts</h1>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  try {
                    const json = await window.aiverse.prompts.exportAsJson(toolId);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${tool.name}_prompts_${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    console.error('Failed to export prompts:', e);
                    alert('Failed to export prompts');
                  }
                }}
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
                Export as JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      <ToolNavigation />

      <div style={{ display: 'grid', gap: 16, maxWidth: 800, padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{editing ? 'Edit Prompt' : 'New Prompt'}</h2>
        <input 
          placeholder="Title" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: '10px 14px', fontSize: 14 }}
        />
        <textarea 
          placeholder="Content" 
          rows={8} 
          value={content} 
          onChange={(e) => setContent(e.target.value)}
          style={{ padding: '10px 14px', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <input 
          placeholder="Tags (comma-separated)" 
          value={tags} 
          onChange={(e) => setTags(e.target.value)}
          style={{ padding: '10px 14px', fontSize: 14 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={onSave}
            style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500, background: 'var(--accent)', color: 'white', border: 'none' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
          >
            {editing ? 'Update' : 'Create'}
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(null);
                setTitle('');
                setContent('');
                setTags('');
              }}
              style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500 }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 14, fontWeight: 500 }}>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '6px 12px', fontSize: 14 }}>
              <option value="updated">Last Modified</option>
              <option value="created">Created Date</option>
              <option value="title">Title</option>
            </select>
            <button
              onClick={() => setSortDesc(!sortDesc)}
              style={{
                padding: '6px 12px',
                fontSize: 14,
                borderRadius: 6,
                minWidth: '40px'
              }}
              title={sortDesc ? 'Descending (click for ascending)' : 'Ascending (click for descending)'}
            >
              {sortDesc ? '↓' : '↑'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>Filter by tags:</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {allTags.map(tag => (
              <label key={tag} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 12px', background: filterTags.includes(tag) ? 'var(--accent)' : 'var(--tag-bg)', color: filterTags.includes(tag) ? 'white' : 'var(--tag-text)', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={filterTags.includes(tag)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFilterTags([...filterTags, tag]);
                    } else {
                      setFilterTags(filterTags.filter(t => t !== tag));
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
                {tag}
              </label>
            ))}
            {allTags.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>(no tags yet)</span>}
          </div>
          {filterTags.length > 1 && (
            <button
              onClick={() => setFilterMode(filterMode === 'AND' ? 'OR' : 'AND')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600
              }}
              title={filterMode === 'AND' ? 'Requires all selected tags (click for ANY)' : 'Requires any selected tag (click for ALL)'}
            >
              {filterMode}
            </button>
          )}
          {filterTags.length > 0 && (
            <button
              onClick={() => setFilterTags([])}
              style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6 }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 8,
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: 0 }}>No prompts found</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredAndSorted.map((p) => (
            <div 
              key={p.id} 
              style={{ 
                border: '1px solid var(--border)', 
                borderRadius: 8, 
                padding: 20, 
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px 0' }}>{p.title}</h3>
                  {p.tags && (
                    <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.tags.split(',').map((tag, i) => (
                        <span key={i} style={{ background: 'var(--tag-bg)', color: 'var(--tag-text)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Created: {new Date(p.createdAt).toLocaleString()} • Updated: {new Date(p.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => copyToClipboard(p.content)} style={{ fontSize: 13, padding: '6px 12px' }}>Copy</button>
                  <button onClick={() => startEdit(p)} style={{ fontSize: 13, padding: '6px 12px' }}>Edit</button>
                  <button
                    onClick={async () => {
                      if (confirm('Delete this prompt?')) {
                        await window.aiverse.prompts.delete(p.id);
                        refresh();
                      }
                    }}
                    style={{ fontSize: 13, padding: '6px 12px', background: 'var(--danger)', color: 'white', border: 'none' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ 
                whiteSpace: 'pre-wrap', 
                padding: '16px', 
                background: 'var(--bg-tertiary)', 
                borderRadius: 6,
                fontSize: 14,
                lineHeight: 1.6,
                fontFamily: 'inherit',
                color: 'var(--text-primary)'
              }}>
                {p.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


