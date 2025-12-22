import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import ToolNavigation from '../components/ToolNavigation.jsx';
import ToolIcon from '../components/ToolIcon.jsx';

export default function Files() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const toolId = Number(id);
  const [tool, setTool] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'date', 'size', 'type'
  const [sortAsc, setSortAsc] = useState(true);
  const [filterTags, setFilterTags] = useState('');

  async function refresh() {
    const tools = await window.aiverse.tools.list();
    setTool(tools.find(t => t.id === toolId) || null);
  }

  async function scanFiles(subPath = '') {
    if (!tool || !tool.filesFolder) return;
    setLoading(true);
    try {
      const result = await window.aiverse.files.scan(toolId, subPath);
      setFolders(result.folders);
      setFiles(result.files);
      setCurrentPath(result.currentPath);
    } catch (e) {
      console.error('Failed to scan files:', e);
      alert('Failed to scan files folder. Make sure the folder exists and is accessible.');
    } finally {
      setLoading(false);
    }
  }

  function navigateToFolder(folderPath) {
    scanFiles(folderPath);
  }

  function navigateUp() {
    const pathParts = currentPath.split(/[\\/]/).filter(Boolean);
    pathParts.pop();
    const newPath = pathParts.join('/');
    scanFiles(newPath);
  }

  useEffect(() => {
    refresh();
  }, [toolId]);

  useEffect(() => {
    if (tool) {
      scanFiles();
    }
  }, [tool]);

  // Open specific file from query param
  useEffect(() => {
    const fileIdParam = searchParams.get('fileId');
    if (fileIdParam && tool && !selectedFile) {
      const fileId = Number(fileIdParam);
      window.aiverse.files.getById(fileId).then(async fileInfo => {
        if (fileInfo) {
          // Navigate to the folder containing the file if needed
          if (fileInfo.folderPath !== currentPath) {
            await scanFiles(fileInfo.folderPath);
          }
          // Wait a bit for files to update, then find and open
          setTimeout(() => {
            const file = files.find(f => f.id === fileId);
            if (file) {
              setSelectedFile(file);
              setSearchParams({}, { replace: true });
            }
          }, 200);
        }
      }).catch(err => console.error('Failed to get file:', err));
    }
  }, [searchParams, tool, currentPath, files, selectedFile]);

  async function deleteFile(fileId) {
    if (!confirm('Delete this file from disk? This cannot be undone.')) return;
    try {
      await window.aiverse.files.delete(fileId, true);
      setSelectedFile(null);
      scanFiles(currentPath);
    } catch (e) {
      console.error('Failed to delete:', e);
      alert('Failed to delete file');
    }
  }

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return ['Root'];
    const parts = currentPath.split(/[\\/]/).filter(Boolean);
    return ['Root', ...parts];
  }, [currentPath]);

  const sortedAndFilteredFiles = useMemo(() => {
    // Filter by tags
    let filtered = files;
    if (filterTags.trim()) {
      const searchTags = filterTags.toLowerCase().split(',').map(t => t.trim()).filter(t => t);
      filtered = files.filter(file => {
        if (!file.tags) return false;
        const fileTags = file.tags.toLowerCase().split(',').map(t => t.trim());
        return searchTags.some(searchTag => fileTags.some(fileTag => fileTag.includes(searchTag)));
      });
    }
    
    // Sort
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let compareA, compareB;
      
      if (sortBy === 'name') {
        compareA = a.name.toLowerCase();
        compareB = b.name.toLowerCase();
      } else if (sortBy === 'date') {
        compareA = new Date(a.modified);
        compareB = new Date(b.modified);
      } else if (sortBy === 'size') {
        compareA = a.size;
        compareB = b.size;
      } else if (sortBy === 'type') {
        compareA = a.extension.toLowerCase();
        compareB = b.extension.toLowerCase();
      }
      
      if (compareA < compareB) return sortAsc ? -1 : 1;
      if (compareA > compareB) return sortAsc ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [files, sortBy, sortAsc, filterTags]);

  function getFileIcon(extension) {
    if (!extension) return '📄';
    const ext = extension.toLowerCase();
    // Audio files
    if (['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'].includes(ext)) return '🎵';
    // Video files
    if (['.mp4', '.avi', '.mkv', '.mov', '.webm'].includes(ext)) return '🎬';
    // Document files
    if (['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(ext)) return '📄';
    // Code files
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.html', '.css'].includes(ext)) return '💻';
    // Archive files
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return '📦';
    // Default
    return '📁';
  }

  if (!tool) return null;

  if (!tool.filesFolder) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ToolIcon iconPath={tool.iconPath} size={48} />
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0' }}>Files</h1>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {tool.filesFolder && (
                  <button
                    onClick={async () => {
                      try {
                        await window.aiverse.files.openFolder(toolId);
                      } catch (e) {
                        console.error('Failed to open folder:', e);
                        alert('Failed to open folder');
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
                    Open Folder
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <ToolNavigation />

        <div style={{
          padding: '32px 24px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>No files folder configured</p>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>Go to Manage to set one up</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ToolIcon iconPath={tool.iconPath} size={48} />
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0' }}>Files</h1>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  try {
                    await window.aiverse.files.openFolder(toolId);
                  } catch (e) {
                    console.error('Failed to open folder:', e);
                    alert('Failed to open folder');
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
                Open Folder
              </button>
            </div>
          </div>
        </div>
        <button 
          onClick={() => scanFiles(currentPath)} 
          disabled={loading}
          style={{ padding: '8px 16px', fontSize: 14, fontWeight: 500 }}
        >
          {loading ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      <ToolNavigation />

      {/* Breadcrumb navigation */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
        {breadcrumbs.map((crumb, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {index > 0 && <span style={{ color: 'var(--text-tertiary)' }}>/</span>}
            <button
              onClick={() => {
                if (index === 0) {
                  scanFiles('');
                } else {
                  const pathParts = currentPath.split(/[\\/]/).filter(Boolean);
                  const targetPath = pathParts.slice(0, index).join('/');
                  scanFiles(targetPath);
                }
              }}
              style={{
                background: index === breadcrumbs.length - 1 ? 'var(--accent)' : 'transparent',
                color: index === breadcrumbs.length - 1 ? 'white' : 'var(--text-primary)',
                border: index === breadcrumbs.length - 1 ? 'none' : '1px solid var(--border)',
                padding: '6px 12px',
                fontSize: 13,
                cursor: 'pointer',
                borderRadius: 6,
                fontWeight: index === breadcrumbs.length - 1 ? 500 : 400
              }}
            >
              {crumb}
            </button>
          </div>
        ))}
        {currentPath && (
          <button onClick={navigateUp} style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 13, borderRadius: 6 }}>
            ↑ Up
          </button>
        )}
      </div>

      {/* Filter and Sort Controls */}
      <div style={{ display: 'grid', gap: 16, padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
        {/* Filter by tags */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={filterTags}
            onChange={(e) => setFilterTags(e.target.value)}
            placeholder="Filter by tags (comma-separated)..."
            style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
          />
          {filterTags && (
            <button onClick={() => setFilterTags('')} style={{ padding: '8px 16px', fontSize: 14 }}>
              Clear
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            {folders.length} folders, {filterTags ? `${sortedAndFilteredFiles.length} / ` : ''}{files.length} files
          </p>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 14, fontWeight: 500 }}>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '6px 12px', fontSize: 14 }}>
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              style={{ padding: '6px 12px', fontSize: 14, minWidth: '40px', borderRadius: 6 }}
              title={sortAsc ? 'Ascending' : 'Descending'}
            >
              {sortAsc ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {folders.length === 0 && files.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 8,
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: 0 }}>This folder is empty</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {/* Render folders first */}
          {folders.map((folder) => (
            <div
              key={folder.path}
              onClick={() => navigateToFolder(folder.path)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 20,
                cursor: 'pointer',
                backgroundColor: 'var(--bg-secondary)',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 160
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
              <div style={{ fontSize: 48, marginBottom: 8 }}>📁</div>
              <div style={{ fontWeight: 'bold', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {folder.name}
              </div>
            </div>
          ))}
          
          {/* Then render files (sorted and filtered) */}
          {sortedAndFilteredFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => setSelectedFile(file)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 16,
                cursor: 'pointer',
                backgroundColor: 'var(--bg-secondary)',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 160
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
              <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>
                {getFileIcon(file.extension)}
              </div>
              <div style={{ fontSize: 13, flex: 1 }}>
                <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 2 }}>        
                  {file.extension ? file.extension.toUpperCase().substring(1) : ''}
                </div>
                {file.tags && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {file.tags.split(',').map((tag, i) => (
                      <span key={i} style={{ 
                        fontSize: 10, 
                        padding: '2px 6px', 
                        background: 'var(--tag-bg)', 
                        color: 'var(--tag-text)', 
                        borderRadius: 4 
                      }}>
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFile && (
        <FileDetailModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDelete={deleteFile}
          onTagsUpdate={() => scanFiles(currentPath)}
        />
      )}
    </div>
  );
}

function FileDetailModal({ file, onClose, onDelete, onTagsUpdate }) {
  const [tags, setTags] = useState(file.tags || '');
  const [isSavingTags, setIsSavingTags] = useState(false);

  async function saveTags() {
    setIsSavingTags(true);
    try {
      await window.aiverse.files.updateTags(file.id, tags);
      onTagsUpdate();
    } catch (e) {
      console.error('Failed to save tags:', e);
      alert('Failed to save tags');
    } finally {
      setIsSavingTags(false);
    }
  }

  function getFileIcon(extension) {
    if (!extension) return '📄';
    const ext = extension.toLowerCase();
    if (['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'].includes(ext)) return '🎵';
    if (['.mp4', '.avi', '.mkv', '.mov', '.webm'].includes(ext)) return '🎬';
    if (['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(ext)) return '📄';
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.html', '.css'].includes(ext)) return '💻';
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return '📦';
    return '📁';
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 8,
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 24
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 64, textAlign: 'center' }}>
            {getFileIcon(file.extension)}
          </div>
          
          <h4 style={{ margin: 0, textAlign: 'center' }}>{file.name}</h4>

          <div style={{ fontSize: 13 }}>
            <div><strong>Type:</strong> {file.extension.toUpperCase().substring(1)} file</div>
            <div><strong>Size:</strong> {(file.size / 1024).toFixed(1)} KB</div>
            <div><strong>Modified:</strong> {new Date(file.modified).toLocaleString()}</div>
            <div style={{ wordBreak: 'break-all', marginTop: 8 }}>
              <strong>Path:</strong><br />{file.path}
            </div>
          </div>

          {/* Tags (DB-only, never modifies file) */}
          <div style={{ fontSize: 13 }}>
            <label style={{ display: 'block', marginBottom: 4 }}><strong>Tags:</strong></label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Add comma-separated tags..."
              style={{ width: '100%', padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' }}
            />
            <button
              onClick={saveTags}
              disabled={isSavingTags || tags === (file.tags || '')}
              style={{ marginTop: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
            >
              {isSavingTags ? 'Saving...' : 'Save Tags'}
            </button>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
              Stored in database only • Never modifies the file
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <button onClick={() => window.aiverse.files.openInApp(file.path)}>
              Open in Default App
            </button>
            <button onClick={() => window.aiverse.files.showInFolder(file.path)}>
              Show in Folder
            </button>
            <button onClick={onClose}>Close</button>
            <button onClick={() => onDelete(file.id)} style={{ background: 'var(--danger)', color: 'white', border: 'none' }}>
              Delete File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
