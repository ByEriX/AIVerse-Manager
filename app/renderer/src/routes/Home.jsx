import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ToolIcon from '../components/ToolIcon.jsx';

export default function Home() {
  const [tools, setTools] = useState([]);
  const navigate = useNavigate();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState({ includeFiles: false, includeImages: false });
  const [importOptions, setImportOptions] = useState({ includeFiles: false, includeImages: false, mergeMode: 'skip' });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    window.aiverse.tools.list().then(setTools).catch(console.error);
    const off = window.aiverse?.tools?.onChanged?.(() => {
      window.aiverse.tools.list().then(setTools).catch(console.error);
    });
    return () => {
      if (off) off();
    };
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Your Tools</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Manage your AI tools, prompts, images, and files</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={tools.length === 0}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: tools.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: tools.length === 0 ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (tools.length > 0) {
                e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }
            }}
            onMouseLeave={(e) => {
              if (tools.length > 0) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border)';
              }
            }}
          >
            Export
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
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
            Import
          </button>
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

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          onClose={() => setShowExportDialog(false)}
          options={exportOptions}
          onOptionsChange={setExportOptions}
          onExport={async () => {
            setExporting(true);
            // Allow UI to update and spinner to start animating before blocking operations
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            try {
              const result = await window.aiverse.tools.export(exportOptions);
              if (!result.canceled) {
                alert(`Export successful!\n\nTools: ${result.stats.tools}\nPrompts: ${result.stats.prompts}\nFiles: ${result.stats.files}\nImages: ${result.stats.images}\n\nSaved to: ${result.filePath}`);
              }
              // Close dialog regardless of whether export was canceled or successful
              setShowExportDialog(false);
            } catch (e) {
              console.error('Export failed:', e);
              alert(`Export failed: ${e.message}`);
              // Close dialog on error as well
              setShowExportDialog(false);
            } finally {
              setExporting(false);
            }
          }}
          exporting={exporting}
        />
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <ImportDialog
          onClose={() => setShowImportDialog(false)}
          options={importOptions}
          onOptionsChange={setImportOptions}
          onImport={async () => {
            setImporting(true);
            try {
              const filePath = await window.aiverse.open.selectFile({
                filters: [
                  { name: 'ZIP Files', extensions: ['zip'] },
                  { name: 'All Files', extensions: ['*'] }
                ]
              });
              
              if (!filePath) {
                setImporting(false);
                return;
              }

              const result = await window.aiverse.tools.import(filePath, importOptions);
              alert(`Import successful!\n\nTools: ${result.stats.tools.created} created, ${result.stats.tools.skipped} skipped, ${result.stats.tools.replaced} replaced\nPrompts: ${result.stats.prompts.created} created\nFiles: ${result.stats.files.created} created\nImages: ${result.stats.images.created} created`);
              setShowImportDialog(false);
              // Refresh tools list
              window.aiverse.tools.list().then(setTools).catch(console.error);
            } catch (e) {
              console.error('Import failed:', e);
              alert(`Import failed: ${e.message}`);
            } finally {
              setImporting(false);
            }
          }}
          importing={importing}
        />
      )}
    </div>
  );
}

function ExportDialog({ onClose, options, onOptionsChange, onExport, exporting }) {
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
      onClick={exporting ? undefined : onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 8,
          maxWidth: '500px',
          width: '100%',
          padding: 24,
          border: '1px solid var(--border)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600 }}>Export Tool Data</h2>
        <p style={{ margin: '0 0 20px 0', fontSize: 14, color: 'var(--text-secondary)' }}>
          Export all your tools, prompts, and metadata. Optionally include actual files and images.
        </p>

        {exporting && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px',
              marginBottom: 20,
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 6,
              border: '1px solid var(--border)'
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                border: '2px solid var(--border)',
                borderTop: '2px solid var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                Exporting data...
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Please wait, this may take a moment
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 24, opacity: exporting ? 0.5 : 1, pointerEvents: exporting ? 'none' : 'auto' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={options.includeFiles}
              onChange={(e) => onOptionsChange({ ...options, includeFiles: e.target.checked })}
              style={{ cursor: 'pointer' }}
              disabled={exporting}
            />
            <span style={{ fontSize: 14 }}>Include files</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={options.includeImages}
              onChange={(e) => onOptionsChange({ ...options, includeImages: e.target.checked })}
              style={{ cursor: 'pointer' }}
              disabled={exporting}
            />
            <span style={{ fontSize: 14 }}>Include images</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={exporting}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: exporting ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onExport}
            disabled={exporting}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {exporting && (
              <div
                style={{
                  width: 14,
                  height: 14,
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
            )}
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function ImportDialog({ onClose, options, onOptionsChange, onImport, importing }) {
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
      onClick={importing ? undefined : onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 8,
          maxWidth: '500px',
          width: '100%',
          padding: 24,
          border: '1px solid var(--border)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600 }}>Import Tool Data</h2>
        <p style={{ margin: '0 0 20px 0', fontSize: 14, color: 'var(--text-secondary)' }}>
          Import tools, prompts, and metadata from an export file. Optionally import files and images.
        </p>

        {importing && (
          <div
            style={{
              padding: '16px',
              marginBottom: 20,
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 6,
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
              Importing data...
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Please wait, this may take a moment
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 20, opacity: importing ? 0.5 : 1, pointerEvents: importing ? 'none' : 'auto' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={options.includeFiles}
              onChange={(e) => onOptionsChange({ ...options, includeFiles: e.target.checked })}
              style={{ cursor: 'pointer' }}
              disabled={importing}
            />
            <span style={{ fontSize: 14 }}>Import files</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={options.includeImages}
              onChange={(e) => onOptionsChange({ ...options, includeImages: e.target.checked })}
              style={{ cursor: 'pointer' }}
              disabled={importing}
            />
            <span style={{ fontSize: 14 }}>Import images</span>
          </label>
        </div>

        <div style={{ marginBottom: 20, opacity: importing ? 0.5 : 1, pointerEvents: importing ? 'none' : 'auto' }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>If tool exists:</label>
          <select
            value={options.mergeMode}
            onChange={(e) => onOptionsChange({ ...options, mergeMode: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
            disabled={importing}
          >
            <option value="skip">Skip (keep existing)</option>
            <option value="replace">Replace existing</option>
            <option value="merge">Create new (add "(imported)")</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={importing}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: importing ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onImport}
            disabled={importing}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: importing ? 'not-allowed' : 'pointer',
              opacity: importing ? 0.6 : 1
            }}
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}


