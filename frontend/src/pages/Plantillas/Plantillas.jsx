import { useEffect, useState } from 'react';
import { FileText, Plus, Save } from 'lucide-react';
import { plantillas as plantillasAPI } from '../../services/api';

const emptyForm = { codigo: '', titulo: '', tipo: 'Nota', cuerpo_plantilla: '', variables_requeridas: [] };

export default function Plantillas() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cargar = async () => {
    setLoading(true);
    try {
      const response = await plantillasAPI.getAll({ activo: 'false' });
      setItems(response.data || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las plantillas.');
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const actualizar = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const guardar = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      await plantillasAPI.create({ ...form, variables_requeridas: form.variables_requeridas });
      setForm(emptyForm); await cargar();
    } catch (err) { setError(err.message || 'No se pudo guardar la plantilla.'); }
    finally { setSaving(false); }
  };

  return <div className="page">
    <div className="page-header"><h1 className="page-title"><FileText size={22} /> Plantillas</h1><p className="page-subtitle">Administre las plantillas para generar notas oficiales.</p></div>
    {error && <div className="alert alert-danger">{error}</div>}
    <div className="card" style={{ marginBottom: '1.5rem' }}><h3><Plus size={18} /> Nueva plantilla</h3>
      <form onSubmit={guardar} className="form-grid">
        <input className="form-input" required placeholder="Código" value={form.codigo} onChange={e => actualizar('codigo', e.target.value)} />
        <input className="form-input" required placeholder="Título" value={form.titulo} onChange={e => actualizar('titulo', e.target.value)} />
        <input className="form-input" required placeholder="Tipo" value={form.tipo} onChange={e => actualizar('tipo', e.target.value)} />
        <textarea className="form-input" required rows={5} placeholder="Cuerpo de plantilla. Use {{variable}}" value={form.cuerpo_plantilla} onChange={e => actualizar('cuerpo_plantilla', e.target.value)} />
        <button className="btn btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar plantilla'}</button>
      </form>
    </div>
    <div className="card"><div className="table-responsive"><table className="data-table"><thead><tr><th>Código</th><th>Título</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={4}>Cargando...</td></tr> : items.map(item => <tr key={item.id_plantilla}><td><span className="code-tag">{item.codigo}</span></td><td>{item.titulo}</td><td>{item.tipo}</td><td>{item.activo ? 'Activa' : 'Inactiva'}</td></tr>)}
      {!loading && items.length === 0 && <tr><td colSpan={4} className="text-center text-muted">No hay plantillas.</td></tr>}
    </tbody></table></div></div>
  </div>;
}