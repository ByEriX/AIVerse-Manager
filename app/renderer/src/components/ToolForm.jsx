import { useState, useEffect } from 'react';
import { toolTemplates } from '../data/toolTemplates.js';

export default function ToolForm({ tool, onSave, onCancel, onDelete }) {
  const [name, setName] = useState('');
  const [docsUrl, setDocsUrl] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [execPath, setExecPath] = useState('');
  const [iconPath, setIconPath] = useState('');
  const [imagesFolder, setImagesFolder] = useState('');
  const [filesFolder, setFilesFolder] = useState('');
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    if (tool) {
      setName(tool.name || '');
      setDocsUrl(tool.docsUrl || '');
      setAppUrl(tool.appUrl || '');
      setExecPath(tool.execPath || '');
      setIconPath(tool.iconPath || '');
      setImagesFolder(tool.imagesFolder || '');
      setFilesFolder(tool.filesFolder || '');
      setIsLocal(!!tool.execPath);
    }
  }, [tool]);

  async function handleSave() {
    if (!name.trim()) {
      alert('Tool name is required');
      return;
    }
    const payload = {
      name: name.trim(),
      docsUrl: docsUrl.trim() || undefined,
      appUrl: appUrl.trim() || undefined,
      execPath: isLocal ? execPath.trim() || undefined : undefined,
      iconPath: iconPath.trim() || undefined,
      imagesFolder: imagesFolder.trim() || undefined,
      filesFolder: filesFolder.trim() || undefined
    };
    await onSave(payload);
  }

  async function handleDelete() {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      await onDelete();
    }
  }

  async function pickFolder(currentPath, setter) {
    const result = await window.aiverse.open.selectFolder({ defaultPath: currentPath });
    if (result) setter(result);
  }

  async function pickImageFile(currentPath, setter) {
    const result = await window.aiverse.open.selectFile({
      defaultPath: currentPath,
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'ico', 'svg', 'webp'] }
      ]
    });
    if (result) setter(result);
  }

  async function pickExecutable(currentPath, setter) {
    const result = await window.aiverse.open.selectFile({
      defaultPath: currentPath,
      filters: [
        { name: 'Executables', extensions: ['exe', 'app', 'sh', 'bat', 'cmd'] }
      ]
    });
    if (result) setter(result);
  }

  async function applyTemplate(template) {
    setName(template.name);
    setDocsUrl(template.docsUrl || '');
    setAppUrl(template.appUrl || '');
    setExecPath(template.execPath || '');
    setIsLocal(template.isLocal || false);
    
    // If template has an icon, copy it to user data directory
    if (template.iconPath) {
      try {
        // Fetch the bundled asset icon
        const response = await fetch(template.iconPath);
        const blob = await response.blob();
        
        // Convert to data URL
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        // Save to user data directory and get filesystem path
        const savedPath = await window.aiverse.file.saveTemplateIcon(dataUrl, template.id);
        setIconPath(savedPath);
      } catch (error) {
        console.error('Failed to copy template icon:', error);
        // Continue without icon if copying fails
        setIconPath('');
      }
    } else {
      setIconPath('');
    }
  }

  const isNewTool = !tool;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isNewTool ? '1fr 1fr' : '1fr', gap: 24, maxWidth: isNewTool ? 1200 : 600 }}>
      {/* Form Section */}
      <div style={{ display: 'grid', gap: 10, padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
        <h4 style={{ margin: 0 }}>{tool ? 'Edit Tool' : 'New Tool'}</h4>

      <label style={{ display: 'grid', gap: 4 }}>
        <strong>Name *</strong>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ChatGPT" />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={isLocal} onChange={(e) => setIsLocal(e.target.checked)} />
        <span>Local executable (uncheck for online tool)</span>
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <strong>Documentation / Repository URL</strong>
        <input type="text" value={docsUrl} onChange={(e) => setDocsUrl(e.target.value)} placeholder="https://github.com/..." />
      </label>

      {isLocal ? (
        <label style={{ display: 'grid', gap: 4 }}>
          <strong>Executable Path</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={execPath} onChange={(e) => setExecPath(e.target.value)} placeholder="e.g. C:\\Program Files\\..." style={{ flex: 1 }} />
            <button onClick={() => pickExecutable(execPath, setExecPath)}>Browse</button>
          </div>
        </label>
      ) : (
        <label style={{ display: 'grid', gap: 4 }}>
          <strong>App URL (where it launches)</strong>
          <input type="text" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://chat.openai.com/..." />
        </label>
      )}

      <label style={{ display: 'grid', gap: 4 }}>
        <strong>Icon (Image File)</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={iconPath} onChange={(e) => setIconPath(e.target.value)} placeholder="Path to icon image" style={{ flex: 1 }} />
          <button onClick={() => pickImageFile(iconPath, setIconPath)}>Browse</button>
        </div>
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <strong>Images Folder</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={imagesFolder} onChange={(e) => setImagesFolder(e.target.value)} placeholder="Folder for images" style={{ flex: 1 }} />
          <button onClick={() => pickFolder(imagesFolder, setImagesFolder)}>Browse</button>
        </div>
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <strong>Files Folder</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={filesFolder} onChange={(e) => setFilesFolder(e.target.value)} placeholder="Folder for files (audio, code, etc.)" style={{ flex: 1 }} />
          <button onClick={() => pickFolder(filesFolder, setFilesFolder)}>Browse</button>
        </div>
      </label>

        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave}>{tool ? 'Update' : 'Create'}</button>
            <button onClick={onCancel}>Cancel</button>
          </div>
          {tool && onDelete && (
            <button onClick={handleDelete} style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}>
              Delete Tool
            </button>
          )}
        </div>
      </div>

      {/* Templates Section - Only show when creating new tool */}
      {isNewTool && (
        <div style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-tertiary)', height: 'fit-content' }}>
          <h4 style={{ margin: 0 }}>Apply a Template</h4>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
            Click on a template to pre-fill the form with common tool configurations.
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {toolTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  boxShadow: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-primary)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                {template.iconPath ? (
                  <img
                    src={template.iconPath}
                    alt={template.name}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      objectFit: 'contain',
                      background: 'var(--bg-secondary)',
                      padding: 4
                    }}
                    onError={(e) => {
                      // Fallback if icon doesn't exist
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      color: 'var(--text-tertiary)',
                      fontWeight: 600
                    }}
                  >
                    {template.name.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {template.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {template.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

