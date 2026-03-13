'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | string;

type AgendaBooking = {
  id: string;
  customerName: string;
  customerEmail: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  notes: string | null;
  cancellationReason: string | null;
  service: { name: string };
  staff: { id: string; fullName: string };
};

type AgendaSectionProps = {
  apiUrl: string;
  token: string;
  staffOptions: Array<{ id: string; fullName: string }>;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendiente',  color: '#b45309', bg: '#fef9c3' },
  confirmed: { label: 'Confirmada', color: '#166534', bg: '#dcfce7' },
  cancelled: { label: 'Cancelada',  color: '#991b1b', bg: '#fee2e2' },
  completed: { label: 'Completada', color: '#1e3a5f', bg: '#dbeafe' },
  no_show:   { label: 'No asistió', color: '#4b5563', bg: '#f3f4f6' }
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, color: '#555', bg: '#f5f5f5' };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

const today = new Date().toISOString().slice(0, 10);
const oneWeekLater = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

export function AgendaSection({ apiUrl, token, staffOptions }: AgendaSectionProps) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(oneWeekLater);
  const [filterStaffId, setFilterStaffId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [bookings, setBookings] = useState<AgendaBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cancel state
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!token.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError('');
    try {
      const url = new URL('/dashboard/appointments', apiUrl);
      url.searchParams.set('range', 'month');
      // Use from/to by expanding the date range around "from"
      url.searchParams.set('date', from);
      if (filterStaffId) url.searchParams.set('staffId', filterStaffId);
      if (filterStatus) url.searchParams.set('status', filterStatus);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const data = (await res.json()) as { bookings: AgendaBooking[] };
      // Client-side date filter since API uses period-based queries
      const fromMs = new Date(from).getTime();
      const toMs = new Date(to).getTime() + 86_400_000; // inclusive
      setBookings(
        (data.bookings ?? []).filter((b) => {
          const t = new Date(b.startAt).getTime();
          return t >= fromMs && t <= toMs;
        })
      );
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Error al cargar citas');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, from, to, filterStaffId, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCancel() {
    if (!cancelId) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      const res = await fetch(`${apiUrl}/bookings/${cancelId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() || undefined })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      setCancelSuccess('Cita cancelada y notificación enviada al cliente.');
      setCancelId(null);
      setCancelReason('');
      setBookings((prev) =>
        prev.map((b) => (b.id === cancelId ? { ...b, status: 'cancelled', cancellationReason: cancelReason.trim() || null } : b))
      );
      setTimeout(() => setCancelSuccess(''), 4000);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'No se pudo cancelar');
    } finally {
      setCancelLoading(false);
    }
  }

  // Group bookings by staff
  const grouped = bookings.reduce<Record<string, { staff: AgendaBooking['staff']; items: AgendaBooking[] }>>((acc, b) => {
    const key = b.staff.id;
    if (!acc[key]) acc[key] = { staff: b.staff, items: [] };
    acc[key].items.push(b);
    return acc;
  }, {});
  const groups = Object.values(grouped).sort((a, b) => a.staff.fullName.localeCompare(b.staff.fullName));

  return (
    <section className="section-block" style={{ marginTop: 28 }}>
      <h2 className="section-title">Agenda</h2>
      <p className="section-subtitle">Citas del negocio, agrupadas por profesional.</p>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          alignItems: 'flex-end',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 16px'
        }}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: 13, flex: '1 1 130px' }}>
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full" />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, flex: '1 1 130px' }}>
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full" />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, flex: '1 1 150px' }}>
          Profesional
          <select value={filterStaffId} onChange={(e) => setFilterStaffId(e.target.value)} className="w-full">
            <option value="">Todos</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, flex: '1 1 130px' }}>
          Estado
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full">
            <option value="">Todos</option>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn btn-primary" style={{ height: 36, alignSelf: 'flex-end' }}>
          {loading ? 'Cargando...' : '↻ Actualizar'}
        </button>
      </div>

      {/* Feedback */}
      {error ? <div className="panel" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', marginBottom: 12, fontSize: 13 }}>{error}</div> : null}
      {cancelSuccess ? <div className="panel" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', marginBottom: 12, fontSize: 13 }}>{cancelSuccess}</div> : null}

      {/* Cancel confirmation modal */}
      {cancelId ? (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Cancelar cita</h3>
            <p style={{ margin: 0, fontSize: 14, color: '#555' }}>
              Esta acción no se puede deshacer. Se enviará un correo de notificación al cliente.
            </p>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Motivo (opcional)
              <input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: El profesional no estará disponible"
                className="w-full"
                autoFocus
              />
            </label>
            {cancelError ? <div style={{ fontSize: 12, color: '#b91c1c' }}>{cancelError}</div> : null}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setCancelId(null); setCancelReason(''); setCancelError(''); }}
                className="btn btn-ghost"
                disabled={cancelLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={cancelLoading}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', opacity: cancelLoading ? 0.6 : 1 }}
              >
                {cancelLoading ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && bookings.length === 0 && !error ? (
        <div className="panel" style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
          No hay citas en el período seleccionado.
        </div>
      ) : null}

      {/* Grouped by staff */}
      {groups.map(({ staff, items }) => (
        <div key={staff.id} style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              padding: '8px 14px', background: 'var(--surface-muted, #f8fafc)',
              borderRadius: 10, border: '1px solid var(--border)'
            }}
          >
            <div
              style={{
                width: 32, height: 32, borderRadius: '50%', background: '#2563eb22',
                color: '#2563eb', fontWeight: 800, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}
            >
              {staff.fullName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{staff.fullName}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
              {items.length} {items.length === 1 ? 'cita' : 'citas'}
            </span>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {items.map((b) => {
              const meta = statusMeta(b.status);
              const isCancellable = b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'no_show';
              return (
                <div
                  key={b.id}
                  className="panel"
                  style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    opacity: b.status === 'cancelled' ? 0.65 : 1
                  }}
                >
                  {/* Status badge */}
                  <span
                    style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 999,
                      padding: '3px 10px', color: meta.color, background: meta.bg
                    }}
                  >
                    {meta.label}
                  </span>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{b.customerName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{b.customerEmail}</div>
                    <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
                      🗓 {fmt(b.startAt)} · {b.service.name}
                    </div>
                    {b.cancellationReason ? (
                      <div style={{ fontSize: 12, color: '#991b1b', marginTop: 2 }}>
                        Motivo: {b.cancellationReason}
                      </div>
                    ) : null}
                    {b.notes ? (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Notas: {b.notes}</div>
                    ) : null}
                  </div>

                  {/* Actions */}
                  {isCancellable ? (
                    <button
                      type="button"
                      onClick={() => { setCancelId(b.id); setCancelReason(''); setCancelError(''); }}
                      style={{
                        flexShrink: 0, background: 'transparent', border: '1px solid #fca5a5',
                        color: '#dc2626', borderRadius: 8, padding: '5px 12px',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Cancelar cita
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
