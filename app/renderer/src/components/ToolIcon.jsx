import { useEffect, useState } from 'react';

export default function ToolIcon({ iconPath, size = 32 }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!iconPath) {
      setDataUrl(null);
      return;
    }
    
    // Check if iconPath is already a data URL or HTTP URL (external URLs)
    // These should be used directly, not read as filesystem paths
    if (iconPath.startsWith('data:') || iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
      setDataUrl(iconPath);
      return;
    }
    
    // Check if iconPath looks like a bundled asset URL (Vite/esbuild format)
    // These are web URLs, not filesystem paths, so use them directly
    if (iconPath.startsWith('/') && (iconPath.includes('/assets/') || iconPath.includes('/_vite/') || iconPath.includes('/dist/'))) {
      setDataUrl(iconPath);
      return;
    }
    
    // Otherwise, treat it as a filesystem path
    window.aiverse.file.readAsDataUrl(iconPath)
      .then(url => setDataUrl(url))
      .catch(err => {
        console.error('Failed to load icon:', err);
        setDataUrl(null);
      });
  }, [iconPath]);

  if (dataUrl) {
    return <img src={dataUrl} width={size} height={size} style={{ borderRadius: 6, objectFit: 'cover' }} alt="Tool icon" />;
  }

  return (
    <div style={{ width: size, height: size, background: 'var(--bg-tertiary)', borderRadius: 6 }} />
  );
}

