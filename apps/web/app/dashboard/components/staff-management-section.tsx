'use client';

import { useCallback, useEffect, useState } from 'react';
import { Notice } from './notice';

type StaffRecord = {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  userId: string | null;
  createdAt: string;
};

type StaffManagementSectionProps = {
  apiUrl: string;
  token: string;
  onStaffChanged?: () => void;
};

export function StaffManagementSection({ apiUrl, token, onStaffChanged }: StaffManagementSectionProps) {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(new URL('/staff', apiUrl).toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      setStaff(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar staff');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(member: StaffRecord) {
    setEditId(member.id);
    setEditName(member.fullName);
    setEditEmail(member.email);
    setEditActive(member.active);
    setEditError('');
  }

  function cancelEdit() {
    setEditId(null);
    setEditName('');
    setEditEmail('');
    setEditActive(true);
    setEditError('');
  }

  async function handleSaveEdit() {
    if (!editId) return;
    setEditLoading(true);
    setEditError('');
    try {
      const res = await fetch(`${apiUrl}/staff/${editId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editName.trim(),
          email: editEmail.trim(),
          active: editActive
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const updated = (await res.json()) as StaffRecord;
      setStaff((prev) => prev.map((s) => (s.id === editId ? { ...s, ...updated } : s)));
      cancelEdit();
      setSuccess('Staff actualizado.');
      onStaffChanged?.();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/staff/${deleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      setStaff((prev) => prev.filter((s) => s.id !== deleteId));
      setDeleteId(null);
      setSuccess('Staff eliminado.');
      onStaffChanged?.();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <section className="section-block" style={{ marginTop: 28 }}>
      <h2 className="section-title">Gestión de Staff</h2>
      <p className="section-subtitle">Lista completa de miembros del equipo. Edita, activa/desactiva o elimina.</p>

      <div className="section-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="btn btn-ghost section-button-lg"
        >
          {loading ? 'Cargando...' : 'Actualizar lista'}
        </button>
      </div>

      <Notice tone="error" message={error} withMargin onClose={() => setError('')} />
      <Notice tone="success" message={success} withMargin onClose={() => setSuccess('')} />

      {/* Delete confirmation */}
      {deleteId && (
        <div className="panel" style={{ marginBottom: 12, padding: 16, border: '1px solid var(--danger, #b91c1c)', borderRadius: 8 }}>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#991b1b' }}>
            ¿Eliminar a {staff.find((s) => s.id === deleteId)?.fullName}?
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
            Se eliminarán sus reglas de disponibilidad, excepciones y asignaciones. Esta acción no se puede deshacer.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={deleteLoading}
              onClick={handleDelete}
              style={{ background: 'var(--danger, #b91c1c)', fontSize: 13 }}
            >
              {deleteLoading ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={deleteLoading}
              onClick={() => setDeleteId(null)}
              style={{ fontSize: 13 }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Staff table */}
      <div className="panel">
        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Cuenta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  {editId === member.id ? (
                    <>
                      <td>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ width: '100%', minWidth: 120 }}
                        />
                      </td>
                      <td>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          style={{ width: '100%', minWidth: 140 }}
                        />
                      </td>
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                          />
                          {editActive ? 'Activo' : 'Inactivo'}
                        </label>
                      </td>
                      <td style={{ fontSize: 12, color: '#94a3b8' }}>—</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={editLoading || !editName.trim() || !editEmail.trim()}
                            onClick={handleSaveEdit}
                            style={{ fontSize: 12 }}
                          >
                            {editLoading ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={editLoading}
                            onClick={cancelEdit}
                            style={{ fontSize: 12 }}
                          >
                            Cancelar
                          </button>
                        </div>
                        {editError && <div style={{ color: '#991b1b', fontSize: 11, marginTop: 4 }}>{editError}</div>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 500 }}>{member.fullName}</td>
                      <td style={{ fontSize: 13 }}>{member.email}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 99,
                            color: member.active ? '#166534' : '#991b1b',
                            background: member.active ? '#dcfce7' : '#fee2e2'
                          }}
                        >
                          {member.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: member.userId ? '#166534' : '#94a3b8'
                          }}
                        >
                          {member.userId ? 'Registrado' : 'Sin cuenta'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => startEdit(member)}
                            style={{ fontSize: 12 }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setDeleteId(member.id)}
                            style={{ fontSize: 12, color: 'var(--danger, #b91c1c)' }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {!staff.length && !loading ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No hay miembros de staff. Crea uno desde Operaciones &gt; Crear staff.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
