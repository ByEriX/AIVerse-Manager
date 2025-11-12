import { Link, useLocation, useParams } from 'react-router-dom';

export default function ToolNavigation() {
  const { id } = useParams();
  const location = useLocation();

  if (!id) return null;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
      <Link
        to={`/tool/${id}`}
        style={{
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 500,
          color: location.pathname === `/tool/${id}` ? 'var(--accent)' : 'var(--text-secondary)',
          textDecoration: 'none',
          borderBottom: location.pathname === `/tool/${id}` ? '2px solid var(--accent)' : '2px solid transparent',
          marginBottom: '-1px',
          transition: 'all 0.15s ease'
        }}
      >
        Overview
      </Link>
      <Link
        to={`/tool/${id}/prompts`}
        style={{
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 500,
          color: location.pathname === `/tool/${id}/prompts` ? 'var(--accent)' : 'var(--text-secondary)',
          textDecoration: 'none',
          borderBottom: location.pathname === `/tool/${id}/prompts` ? '2px solid var(--accent)' : '2px solid transparent',
          marginBottom: '-1px',
          transition: 'all 0.15s ease'
        }}
      >
        Prompts
      </Link>
      <Link
        to={`/tool/${id}/images`}
        style={{
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 500,
          color: location.pathname === `/tool/${id}/images` ? 'var(--accent)' : 'var(--text-secondary)',
          textDecoration: 'none',
          borderBottom: location.pathname === `/tool/${id}/images` ? '2px solid var(--accent)' : '2px solid transparent',
          marginBottom: '-1px',
          transition: 'all 0.15s ease'
        }}
      >
        Images
      </Link>
      <Link
        to={`/tool/${id}/files`}
        style={{
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 500,
          color: location.pathname === `/tool/${id}/files` ? 'var(--accent)' : 'var(--text-secondary)',
          textDecoration: 'none',
          borderBottom: location.pathname === `/tool/${id}/files` ? '2px solid var(--accent)' : '2px solid transparent',
          marginBottom: '-1px',
          transition: 'all 0.15s ease'
        }}
      >
        Files
      </Link>
    </div>
  );
}

