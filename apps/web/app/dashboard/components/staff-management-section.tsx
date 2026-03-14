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
  university?: string | null;
  degree?: string | null;
  specialty?: string | null;
  bio?: string | null;
  graduationYear?: number | null;
  photoUrl?: string | null;
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
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editDegree, setEditDegree] = useState('');
  const [editUniversity, setEditUniversity] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editGraduationYear, setEditGraduationYear] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
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
    setEditSpecialty(member.specialty ?? '');
    setEditDegree(member.degree ?? '');
    setEditUniversity(member.university ?? '');
    setEditBio(member.bio ?? '');
    setEditGraduationYear(member.graduationYear ? String(member.graduationYear) : '');
    setEditPhotoUrl(member.photoUrl ?? '');
    setEditError('');
  }

  function cancelEdit() {
    setEditId(null);
    setEditName('');
    setEditEmail('');
    setEditActive(true);
    setEditSpecialty('');
    setEditDegree('');
    setEditUniversity('');
    setEditBio('');
    setEditGraduationYear('');
    setEditPhotoUrl('');
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
          active: editActive,
          specialty: editSpecialty.trim() || null,
          degree: editDegree.trim() || null,
          university: editUniversity.trim() || null,
          bio: editBio.trim() || null,
          graduationYear: editGraduationYear.trim() ? Number(editGraduationYear) : null,
          photoUrl: editPhotoUrl.trim() || null
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
                <th>Especialidad</th>
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
                      <td colSpan={6}>
                        <div style={{ display: 'grid', gap: 10, padding: '8px 0' }}>
                          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                            <label style={{ fontSize: 12 }}>
                              Nombre
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{ width: '100%' }}
                              />
                            </label>
                            <label style={{ fontSize: 12 }}>
                              Email
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                style={{ width: '100%' }}
                              />
                            </label>
                            <label style={{ fontSize: 12 }}>
                              Especialidad
                              <input
                                value={editSpecialty}
                                onChange={(e) => setEditSpecialty(e.target.value)}
                                placeholder="Ej: Dermatología"
                                style={{ width: '100%' }}
                              />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, alignSelf: 'end', paddingBottom: 6 }}>
                              <input
                                type="checkbox"
                                checked={editActive}
                                onChange={(e) => setEditActive(e.target.checked)}
                              />
                              {editActive ? 'Activo' : 'Inactivo'}
                            </label>
                          </div>
                          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                            <label style={{ fontSize: 12 }}>
                              Título / Grado
                              <input
                                value={editDegree}
                                onChange={(e) => setEditDegree(e.target.value)}
                                placeholder="Ej: Lic. en Medicina"
                                style={{ width: '100%' }}
                              />
                            </label>
                            <label style={{ fontSize: 12 }}>
                              Universidad
                              <input
                                value={editUniversity}
                                onChange={(e) => setEditUniversity(e.target.value)}
                                placeholder="Ej: UNAM"
                                style={{ width: '100%' }}
                              />
                            </label>
                            <label style={{ fontSize: 12 }}>
                              Año de graduación
                              <input
                                type="number"
                                value={editGraduationYear}
                                onChange={(e) => setEditGraduationYear(e.target.value)}
                                placeholder="Ej: 2018"
                                min={1950}
                                style={{ width: '100%' }}
                              />
                            </label>
                            <label style={{ fontSize: 12 }}>
                              URL de foto
                              <input
                                value={editPhotoUrl}
                                onChange={(e) => setEditPhotoUrl(e.target.value)}
                                placeholder="https://..."
                                style={{ width: '100%' }}
                              />
                            </label>
                          </div>
                          <label style={{ fontSize: 12 }}>
                            Bio
                            <textarea
                              value={editBio}
                              onChange={(e) => setEditBio(e.target.value)}
                              placeholder="Breve descripción profesional..."
                              maxLength={500}
                              style={{ width: '100%', minHeight: 60 }}
                            />
                          </label>
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
                          {editError && <div style={{ color: '#991b1b', fontSize: 11 }}>{editError}</div>}
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 500 }}>{member.fullName}</td>
                      <td style={{ fontSize: 13 }}>{member.email}</td>
                      <td style={{ fontSize: 13, color: '#64748b' }}>{member.specialty || '—'}</td>
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
                  <td colSpan={6} className="table-empty">
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
