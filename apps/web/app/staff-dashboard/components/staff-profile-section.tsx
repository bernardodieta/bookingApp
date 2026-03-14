'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type StaffProfileSectionProps = {
  apiUrl: string;
  token: string;
};

export function StaffProfileSection({ apiUrl, token }: StaffProfileSectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [university, setUniversity] = useState('');
  const [degree, setDegree] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [fullName, setFullName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(new URL('/staff/me', apiUrl).toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const data = await res.json();
      setFullName(data.fullName ?? '');
      setUniversity(data.university ?? '');
      setDegree(data.degree ?? '');
      setSpecialty(data.specialty ?? '');
      setBio(data.bio ?? '');
      setGraduationYear(data.graduationYear ? String(data.graduationYear) : '');
      setPhotoUrl(data.photoUrl ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body: Record<string, unknown> = {
        university: university.trim() || null,
        degree: degree.trim() || null,
        specialty: specialty.trim() || null,
        bio: bio.trim() || null,
        photoUrl: photoUrl.trim() || null,
        graduationYear: graduationYear.trim() ? Number(graduationYear) : null
      };

      const res = await fetch(new URL('/staff/me', apiUrl).toString(), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }

      setSuccess('Perfil actualizado correctamente.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="panel" style={{ padding: 24 }}>
        <p style={{ color: '#64748b' }}>Cargando perfil...</p>
      </div>
    );
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div className="panel" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Mi Perfil Profesional</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
          Estos datos se muestran a los clientes cuando eligen profesional para su cita.
        </p>

        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Nombre</div>
          <div style={{ fontWeight: 600 }}>{fullName}</div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'grid', gap: 14 }}>
          <label>
            Especialidad
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ej: Dermatología, Fisioterapia..."
              style={{ width: '100%' }}
            />
          </label>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <label>
              Título / Grado
              <input
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="Ej: Lic. en Medicina"
                style={{ width: '100%' }}
              />
            </label>
            <label>
              Universidad
              <input
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="Ej: UNAM"
                style={{ width: '100%' }}
              />
            </label>
            <label>
              Año de graduación
              <input
                type="number"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                placeholder="Ej: 2018"
                min={1950}
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <label>
            Bio / Descripción
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Breve descripción profesional que verán tus clientes..."
              maxLength={500}
              style={{ width: '100%', minHeight: 100 }}
            />
            <small style={{ color: '#94a3b8' }}>{bio.length}/500</small>
          </label>

          <label>
            URL de foto de perfil
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              style={{ width: '100%' }}
            />
          </label>

          {error ? <div className="status-error">{error}</div> : null}
          {success ? <div className="status-success">{success}</div> : null}

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ width: 200 }}
          >
            {saving ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </form>
      </div>
    </section>
  );
}
