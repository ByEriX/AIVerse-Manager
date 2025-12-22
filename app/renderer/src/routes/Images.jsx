import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import ToolNavigation from '../components/ToolNavigation.jsx';
import ToolIcon from '../components/ToolIcon.jsx';

export default function Images() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const toolId = Number(id);
  const [tool, setTool] = useState(null);
  const [folders, setFolders] = useState([]);
  const [images, setImages] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'date', 'size'
  const [sortAsc, setSortAsc] = useState(true);
  const [filterTags, setFilterTags] = useState('');

  async function refresh() {
    const tools = await window.aiverse.tools.list();
    setTool(tools.find(t => t.id === toolId) || null);
  }

  async function scanImages(subPath = '') {
    if (!tool || !tool.imagesFolder) return;
    setLoading(true);
    try {
      const result = await window.aiverse.images.scan(toolId, subPath);
      setFolders(result.folders);
      setImages(result.images);
      setCurrentPath(result.currentPath);
    } catch (e) {
      console.error('Failed to scan images:', e);
      alert('Failed to scan images folder. Make sure the folder exists and is accessible.');
    } finally {
      setLoading(false);
    }
  }

  function navigateToFolder(folderPath) {
    scanImages(folderPath);
  }

  function navigateUp() {
    const pathParts = currentPath.split(/[\\/]/).filter(Boolean);
    pathParts.pop();
    const newPath = pathParts.join('/');
    scanImages(newPath);
  }

  useEffect(() => {
    refresh();
  }, [toolId]);

  useEffect(() => {
    if (tool) {
      scanImages();
    }
  }, [tool]);

  // Open specific image from query param
  useEffect(() => {
    const imageIdParam = searchParams.get('imageId');
    if (imageIdParam && tool && !selectedImage) {
      const imageId = Number(imageIdParam);
      window.aiverse.images.getById(imageId).then(async imageInfo => {
        if (imageInfo) {
          // Navigate to the folder containing the image if needed
          if (imageInfo.folderPath !== currentPath) {
            await scanImages(imageInfo.folderPath);
          }
          // Wait a bit for images to update, then find and open
          setTimeout(() => {
            const image = images.find(img => img.id === imageId);
            if (image) {
              openDetails(image);
              setSearchParams({}, { replace: true });
            }
          }, 200);
        }
      }).catch(err => console.error('Failed to get image:', err));
    }
  }, [searchParams, tool, currentPath, images, selectedImage]);

  async function openDetails(image) {
    setSelectedImage(image);
    setMetadata(null);
    if (image.metadata) {
      setMetadata(image.metadata);
    } else {
      const meta = await window.aiverse.images.readMetadata(image.path);
      setMetadata(meta);
    }
  }

  async function deleteImage(imageId) {
    if (!confirm('Delete this image file from disk? This cannot be undone.')) return;
    try {
      await window.aiverse.images.delete(imageId, true);
      setSelectedImage(null);
      scanImages(currentPath);
    } catch (e) {
      console.error('Failed to delete:', e);
      alert('Failed to delete image');
    }
  }

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return ['Root'];
    const parts = currentPath.split(/[\\/]/).filter(Boolean);
    return ['Root', ...parts];
  }, [currentPath]);

  const sortedAndFilteredImages = useMemo(() => {
    // Filter by tags
    let filtered = images;
    if (filterTags.trim()) {
      const searchTags = filterTags.toLowerCase().split(',').map(t => t.trim()).filter(t => t);
      filtered = images.filter(img => {
        if (!img.tags) return false;
        const imageTags = img.tags.toLowerCase().split(',').map(t => t.trim());
        // Show image if it has ANY of the searched tags
        return searchTags.some(searchTag => imageTags.some(imgTag => imgTag.includes(searchTag)));
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
      }
      
      if (compareA < compareB) return sortAsc ? -1 : 1;
      if (compareA > compareB) return sortAsc ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [images, sortBy, sortAsc, filterTags]);

  if (!tool) return null;

  if (!tool.imagesFolder) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ToolIcon iconPath={tool.iconPath} size={48} />
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0' }}>Images</h1>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {tool.imagesFolder && (
                  <button
                    onClick={async () => {
                      try {
                        await window.aiverse.images.openFolder(toolId);
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
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>No images folder configured</p>
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
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0' }}>Images</h1>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  try {
                    await window.aiverse.images.openFolder(toolId);
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
          onClick={() => scanImages(currentPath)} 
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
                  scanImages('');
                } else {
                  const pathParts = currentPath.split(/[\\/]/).filter(Boolean);
                  const targetPath = pathParts.slice(0, index).join('/');
                  scanImages(targetPath);
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
            {folders.length} folders, {filterTags ? `${sortedAndFilteredImages.length} / ` : ''}{images.length} images
          </p>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 14, fontWeight: 500 }}>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '6px 12px', fontSize: 14 }}>
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="size">Size</option>
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

      {folders.length === 0 && images.length === 0 ? (
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
          
          {/* Then render images (sorted and filtered) */}
          {sortedAndFilteredImages.map((img) => (
            <div
              key={img.id}
              onClick={() => openDetails(img)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 12,
                cursor: 'pointer',
                backgroundColor: 'var(--bg-secondary)',
                transition: 'all 0.15s ease',
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
              <ImageThumbnail path={img.path} imageId={img.id} />
              <div style={{ marginTop: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {img.name}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                  {(img.size / 1024).toFixed(1)} KB
                </div>
                {img.tags && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {img.tags.split(',').map((tag, i) => (
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

      {selectedImage && (
        <ImageDetailModal
          image={selectedImage}
          metadata={metadata}
          onClose={() => setSelectedImage(null)}
          onDelete={deleteImage}
          onTagsUpdate={() => scanImages(currentPath)}
        />
      )}
    </div>
  );
}

function ImageThumbnail({ path, imageId }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    // Use cached thumbnail if available
    window.aiverse.images.getThumbnail(path, imageId)
      .then(url => {
        if (url) {
          setDataUrl(url);
        } else {
          // Fallback to full image
          return window.aiverse.file.readAsDataUrl(path);
        }
      })
      .then(url => url && setDataUrl(url))
      .catch(err => console.error('Failed to load thumbnail:', err));
  }, [path, imageId]);

  if (!dataUrl) {
    return (
      <div style={{ width: '100%', paddingTop: '75%', backgroundColor: 'var(--bg-tertiary)', borderRadius: 4, position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', paddingTop: '75%', position: 'relative', overflow: 'hidden', borderRadius: 4 }}>
      <img
        src={dataUrl}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        alt="Thumbnail"
      />
    </div>
  );
}

function ImageDetailModal({ image, metadata, onClose, onDelete, onTagsUpdate }) {
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [tags, setTags] = useState(image.tags || '');
  const [isSavingTags, setIsSavingTags] = useState(false);

  useEffect(() => {
    window.aiverse.file.readAsDataUrl(image.path)
      .then(url => setImageDataUrl(url))
      .catch(err => console.error('Failed to load full image:', err));
  }, [image.path]);

  async function saveTags() {
    setIsSavingTags(true);
    try {
      await window.aiverse.images.updateTags(image.id, tags);
      onTagsUpdate();
    } catch (e) {
      console.error('Failed to save tags:', e);
      alert('Failed to save tags');
    } finally {
      setIsSavingTags(false);
    }
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
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: 16,
          padding: 16
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '80vh' }}>
          {imageDataUrl ? (
            <img src={imageDataUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={image.name} />
          ) : (
            <p>Loading...</p>
          )}
        </div>

          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <h4 style={{ margin: 0 }}>{image.name}</h4>

          <div style={{ fontSize: 13 }}>
            <div><strong>Size:</strong> {(image.size / 1024).toFixed(1)} KB</div>
            <div><strong>Modified:</strong> {new Date(image.modified).toLocaleString()}</div>
            <div style={{ wordBreak: 'break-all', marginTop: 8 }}>
              <strong>Path:</strong><br />{image.path}
            </div>
          </div>

          {/* Tags (DB-only, never modifies image file) */}
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
              disabled={isSavingTags || tags === (image.tags || '')}
              style={{ marginTop: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
            >
              {isSavingTags ? 'Saving...' : 'Save Tags'}
            </button>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
              Stored in database only • Never modifies the image file
            </div>
          </div>

          {metadata && (
            <>
              {/* AI Metadata */}
              {metadata.ai && (
                <div style={{ fontSize: 13, padding: 12, background: 'var(--bg-secondary)', borderRadius: 4, maxHeight: '400px', overflow: 'auto' }}>
                  <strong style={{ display: 'block', marginBottom: 8, color: 'var(--accent)' }}>AI Generation Data:</strong>
                  
                  {metadata.ai.prompt && (
                    <div style={{ marginBottom: 8 }}>
                      <strong>Prompt:</strong>
                      <div style={{ background: 'var(--bg-tertiary)', padding: 8, borderRadius: 4, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {metadata.ai.prompt}
                      </div>
                    </div>
                  )}
                  
                  {metadata.ai.negativePrompt && (
                    <div style={{ marginBottom: 8 }}>
                      <strong>Negative Prompt:</strong>
                      <div style={{ background: 'var(--bg-tertiary)', padding: 8, borderRadius: 4, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {metadata.ai.negativePrompt}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginTop: 8 }}>
                    {metadata.ai.model && <div><strong>Model:</strong> {metadata.ai.model}</div>}
                    {metadata.ai.sampler && <div><strong>Sampler:</strong> {metadata.ai.sampler}</div>}
                    {metadata.ai.steps && <div><strong>Steps:</strong> {metadata.ai.steps}</div>}
                    {metadata.ai.cfgScale && <div><strong>CFG Scale:</strong> {metadata.ai.cfgScale}</div>}
                    {metadata.ai.seed && <div><strong>Seed:</strong> {metadata.ai.seed}</div>}
                    {metadata.ai.modelHash && <div><strong>Model Hash:</strong> {metadata.ai.modelHash}</div>}
                    {metadata.ai.vae && <div><strong>VAE:</strong> {metadata.ai.vae}</div>}
                    {metadata.ai.vaeHash && <div><strong>VAE Hash:</strong> {metadata.ai.vaeHash}</div>}
                    {metadata.ai.clipSkip && <div><strong>Clip Skip:</strong> {metadata.ai.clipSkip}</div>}
                    {metadata.ai.scheduler && <div><strong>Scheduler:</strong> {metadata.ai.scheduler}</div>}
                    {metadata.ai.hiresUpscaler && <div><strong>Hires Upscaler:</strong> {metadata.ai.hiresUpscaler}</div>}
                    {metadata.ai.hiresSteps && <div><strong>Hires Steps:</strong> {metadata.ai.hiresSteps}</div>}
                    {metadata.ai.hiresUpscale && <div><strong>Hires Upscale:</strong> {metadata.ai.hiresUpscale}</div>}
                    {metadata.ai.denoisingStrength && <div><strong>Denoising Strength:</strong> {metadata.ai.denoisingStrength}</div>}
                    {metadata.ai.ensd && <div><strong>ENSD:</strong> {metadata.ai.ensd}</div>}
                    {metadata.ai.size && !metadata.width && <div><strong>Size:</strong> {metadata.ai.size}</div>}
                    {metadata.ai.software && <div style={{ gridColumn: '1 / -1' }}><strong>Software:</strong> {metadata.ai.software}</div>}
                  </div>
                  
                  {/* Loras / TI display */}
                  {(metadata.ai.loras || metadata.ai.loraHashes || metadata.ai.tiHashes) && (
                    <div style={{ marginTop: 8 }}>
                      {metadata.ai.loras && (
                        <div style={{ marginBottom: 4 }}>
                          <strong>Loras:</strong>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                            {Array.isArray(metadata.ai.loras) ? (
                              metadata.ai.loras.map((lora, i) => (
                                <span key={i} style={{ 
                                  fontSize: 11, 
                                  padding: '2px 6px', 
                                  background: 'var(--tag-bg)', 
                                  color: 'var(--tag-text)', 
                                  borderRadius: 4 
                                }}>
                                  {lora}
                                </span>
                              ))
                            ) : (
                              <span style={{ 
                                fontSize: 11, 
                                padding: '2px 6px', 
                                background: 'var(--tag-bg)', 
                                color: 'var(--tag-text)', 
                                borderRadius: 4 
                              }}>
                                {metadata.ai.loras}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {metadata.ai.loraHashes && (
                        <div style={{ marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                          <strong>Lora Hashes:</strong> {metadata.ai.loraHashes}
                        </div>
                      )}
                      {metadata.ai.tiHashes && (
                        <div style={{ marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                          <strong>TI Hashes:</strong> {metadata.ai.tiHashes}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {metadata.ai.description && !metadata.ai.prompt && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Description:</strong>
                      <div style={{ background: 'var(--bg-tertiary)', padding: 8, borderRadius: 4, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
                        {metadata.ai.description}
                      </div>
                    </div>
                  )}
                  
                  {metadata.ai.userComment && !metadata.ai.prompt && (
                    <div style={{ marginTop: 8 }}>
                      <strong>User Comment:</strong>
                      <div style={{ background: 'var(--bg-tertiary)', padding: 8, borderRadius: 4, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
                        {metadata.ai.userComment}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Standard EXIF Metadata - only show if there's something to display */}
              {(metadata.width || metadata.camera || metadata.dateTaken) && (
                <div style={{ fontSize: 13, padding: 12, background: 'var(--bg-secondary)', borderRadius: 4 }}>
                  <strong>Image Info:</strong>
                  {metadata.width && <div>Dimensions: {metadata.width} × {metadata.height}</div>}
                  {metadata.camera && <div>Camera: {metadata.camera}</div>}
                  {metadata.cameraModel && <div>Model: {metadata.cameraModel}</div>}
                  {metadata.dateTaken && <div>Date Taken: {metadata.dateTaken}</div>}
                  {metadata.artist && <div>Artist: {metadata.artist}</div>}
                </div>
              )}
              
              {!metadata.ai && !metadata.width && !metadata.camera && (
                <div style={{ fontSize: 13, padding: 12, background: 'var(--bg-secondary)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                  No metadata found
                </div>
              )}
            </>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            <button onClick={() => window.aiverse.images.openInViewer(image.path)}>
              Open in Image Viewer
            </button>
            <button onClick={() => window.aiverse.images.showInFolder(image.path)}>
              Show in Folder
            </button>
            <button onClick={onClose}>Close</button>
            <button onClick={() => onDelete(image.id)} style={{ background: 'var(--danger)', color: 'white', border: 'none' }}>
              Delete File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


