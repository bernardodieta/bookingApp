'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'rescheduled' | string;

type StaffBooking = {
  id: string;
  customerName: string;
  customerEmail: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  notes: string | null;
  cancellationReason: string | null;
  service: { name: string };
  staff: { fullName: string };
};

type StaffBookingsSectionProps = {
  apiUrl: string;
  token: string;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pendiente',     color: '#b45309', bg: '#fef9c3' },
  confirmed:   { label: 'Confirmada',    color: '#166534', bg: '#dcfce7' },
  cancelled:   { label: 'Cancelada',     color: '#991b1b', bg: '#fee2e2' },
  completed:   { label: 'Completada',    color: '#1e3a5f', bg: '#dbeafe' },
  rescheduled: { label: 'Reprogramada',  color: '#6d28d9', bg: '#ede9fe' },
  no_show:     { label: 'No asistió',    color: '#4b5563', bg: '#f3f4f6' }
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, color: '#555', bg: '#f5f5f5' };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export function StaffBookingsSection({ apiUrl, token }: StaffBookingsSectionProps) {
  const [bookings, setBookings] = useState<StaffBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

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
      const url = new URL('/bookings/my', apiUrl);
      if (filterStatus) url.searchParams.set('status', filterStatus);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const data = (await res.json()) as StaffBooking[];
      setBookings(data);
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Error al cargar citas');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, filterStatus]);

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
      setCancelSuccess('Cita cancelada exitosamente.');
      setBookings((prev) =>
        prev.map((b) =>
          b.id === cancelId
            ? { ...b, status: 'cancelled', cancellationReason: cancelReason.trim() || null }
            : b
        )
      );
      setCancelId(null);
      setCancelReason('');
      setTimeout(() => setCancelSuccess(''), 4000);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'No se pudo cancelar');
    } finally {
      setCancelLoading(false);
    }
  }

  const upcoming = bookings.filter((b) => new Date(b.startAt) >= new Date() && b.status !== 'cancelled');
  const past = bookings.filter((b) => new Date(b.startAt) < new Date() || b.status === 'cancelled');

  return (
    <section>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Mis Citas</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#64748b' }}>Todas las citas asignadas a ti.</p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', fontSize: 13 }}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmada</option>
          <option value="cancelled">Cancelada</option>
          <option value="completed">Completada</option>
          <option value="rescheduled">Reprogramada</option>
          <option value="no_show">No asistió</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="btn btn-ghost"
          style={{ fontSize: 13 }}
        >
          Actualizar
        </button>
      </div>

      {cancelSuccess && <div className="status-success" style={{ marginBottom: 12 }}>{cancelSuccess}</div>}
      {error && <div className="status-error" style={{ marginBottom: 12 }}>{error}</div>}
      {loading && <p style={{ color: '#94a3b8', fontSize: 14 }}>Cargando citas...</p>}

      {/* Cancel modal */}
      {cancelId && (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            padding: 16,
            border: '1px solid var(--danger, #b91c1c)',
            borderRadius: 8
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#991b1b' }}>
            Cancelar cita
          </h3>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 500, color: '#374151' }}>
            Razón (opcional)
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              style={{ width: '100%', resize: 'vertical' }}
              placeholder="Motivo de la cancelación..."
            />
          </label>
          {cancelError && <div className="status-error" style={{ marginTop: 8 }}>{cancelError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={cancelLoading}
              onClick={handleCancel}
              style={{ background: 'var(--danger, #b91c1c)', fontSize: 13 }}
            >
              {cancelLoading ? 'Cancelando...' : 'Confirmar cancelación'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={cancelLoading}
              onClick={() => {
                setCancelId(null);
                setCancelReason('');
                setCancelError('');
              }}
              style={{ fontSize: 13 }}
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Upcoming bookings */}
      {upcoming.length > 0 && (
        <>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Próximas ({upcoming.length})
          </h3>
          <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
            {upcoming.map((b) => (
              <BookingCard key={b.id} booking={b} onCancel={() => setCancelId(b.id)} />
            ))}
          </div>
        </>
      )}

      {/* Past bookings */}
      {past.length > 0 && (
        <>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Anteriores / Canceladas ({past.length})
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {past.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        </>
      )}

      {!loading && bookings.length === 0 && (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
          No tienes citas registradas.
        </div>
      )}
    </section>
  );
}

function BookingCard({ booking, onCancel }: { booking: StaffBooking; onCancel?: () => void }) {
  const meta = statusMeta(booking.status);
  const canCancel =
    onCancel &&
    booking.status !== 'cancelled' &&
    booking.status !== 'completed' &&
    booking.status !== 'no_show';

  return (
    <div
      className="panel"
      style={{
        padding: '14px 16px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        alignItems: 'start'
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <strong style={{ fontSize: 14 }}>{booking.customerName}</strong>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: meta.color,
              background: meta.bg,
              padding: '2px 8px',
              borderRadius: 99
            }}
          >
            {meta.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          {booking.service.name} &middot; {fmt(booking.startAt)} — {fmt(booking.endAt)}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>{booking.customerEmail}</p>
        {booking.notes && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>{booking.notes}</p>
        )}
        {booking.cancellationReason && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#991b1b' }}>
            Razón: {booking.cancellationReason}
          </p>
        )}
      </div>
      {canCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost"
          style={{ fontSize: 12, color: 'var(--danger, #b91c1c)', whiteSpace: 'nowrap' }}
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
