import { useNavigate } from 'react-router-dom';
import ToolForm from '../components/ToolForm.jsx';

export default function NewTool() {
  const navigate = useNavigate();

  async function handleCreate(payload) {
    try {
      const result = await window.aiverse.tools.create(payload);
      // Use the ID returned from create() instead of searching the list
      // (which is sorted alphabetically, not by creation order)
      navigate(`/tool/${result.id}`);
    } catch (e) {
      console.error(e);
      alert('Failed to create tool. Check console.');
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 16px 0' }}>New Tool</h1>
      <ToolForm onSave={handleCreate} onCancel={() => navigate('/')} />
    </div>
  );
}

