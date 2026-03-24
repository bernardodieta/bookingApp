'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Clock, RefreshCw } from 'lucide-react';

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
  staffName: string;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; borderClass: string }> = {
  pending:     { label: 'Pendiente',     color: '#BA7517', bg: '#FAEEDA', borderClass: 'booking-card-pending' },
  confirmed:   { label: 'Confirmada',    color: '#0D5C44', bg: '#EFF8F5', borderClass: 'booking-card-confirmed' },
  cancelled:   { label: 'Cancelada',     color: '#E24B4A', bg: '#FCEBEB', borderClass: 'booking-card-cancelled' },
  completed:   { label: 'Completada',    color: '#1e3a5f', bg: '#dbeafe', borderClass: 'booking-card-completed' },
  rescheduled: { label: 'Reprogramada',  color: '#6d28d9', bg: '#ede9fe', borderClass: '' },
  no_show:     { label: 'No asistió',    color: '#4b5563', bg: '#f3f4f6', borderClass: '' }
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, color: '#555', bg: '#f5f5f5', borderClass: '' };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function SkeletonBookings() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="skeleton" style={{ height: 28, width: '45%' }} />
      <div className="skeleton" style={{ height: 18, width: '30%' }} />
      <div className="stats-strip">
        <div className="skeleton" style={{ height: 72 }} />
        <div className="skeleton" style={{ height: 72 }} />
        <div className="skeleton" style={{ height: 72 }} />
      </div>
      <div className="skeleton" style={{ height: 80 }} />
      <div className="skeleton" style={{ height: 80 }} />
      <div className="skeleton" style={{ height: 80 }} />
    </div>
  );
}

export function StaffBookingsSection({ apiUrl, token, staffName }: StaffBookingsSectionProps) {
  const [bookings, setBookings] = useState<StaffBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showPast, setShowPast] = useState(false);

  // Cancel state
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

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

  // Close cancel modal on Escape
  useEffect(() => {
    if (!cancelId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setCancelId(null);
        setCancelReason('');
        setCancelError('');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelId]);

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

  async function handleQuickAction(bookingId: string, action: 'confirm' | 'complete' | 'no-show') {
    try {
      const res = await fetch(`${apiUrl}/bookings/${bookingId}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const updated = (await res.json()) as StaffBooking;
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: updated.status } : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar cita');
    }
  }

  // Compute grouped bookings
  const now = new Date();
  const todayBookings = bookings.filter((b) => isToday(b.startAt) && b.status !== 'cancelled');
  const upcomingBookings = bookings.filter(
    (b) => new Date(b.startAt) > now && !isToday(b.startAt) && b.status !== 'cancelled'
  );
  const pastBookings = bookings.filter(
    (b) => (new Date(b.startAt) < now && !isToday(b.startAt)) || b.status === 'cancelled'
  );

  // Stats
  const todayCount = todayBookings.length;
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const nextBooking = [...todayBookings, ...upcomingBookings]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .find((b) => new Date(b.startAt) >= now);

  const displayName = staffName.includes('@') ? staffName.split('@')[0] : staffName;

  return (
    <section>
      {/* Greeting */}
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: '#1A1917' }}>
        {getGreeting()}, {displayName}
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#9E9B93' }}>
        {loading ? 'Cargando tus citas...' : `Tienes ${todayCount} cita${todayCount !== 1 ? 's' : ''} para hoy`}
      </p>

      {/* Stats strip */}
      {!loading && (
        <div className="stats-strip">
          <div className="stat-card">
            <div>
              <div className="stat-label">Citas hoy</div>
              <div className="stat-value">{todayCount}</div>
            </div>
            <CalendarDays size={20} style={{ color: '#9E9B93' }} />
          </div>
          <div className="stat-card" style={pendingCount > 0 ? { borderColor: '#f59e0b' } : undefined}>
            <div>
              <div className="stat-label">Pendientes</div>
              <div className="stat-value" style={pendingCount > 0 ? { color: 'var(--warning)' } : undefined}>
                {pendingCount}
              </div>
            </div>
            <Clock size={20} style={{ color: pendingCount > 0 ? 'var(--warning)' : '#9E9B93' }} />
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-label">Siguiente cita</div>
              {nextBooking ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {fmtTime(nextBooking.startAt)} · {nextBooking.customerName}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#9E9B93' }}>Sin citas</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--border, #D8D5CF)', fontSize: 13 }}
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
          style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px' }}
          title="Actualizar"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {cancelSuccess && <div className="status-success" style={{ marginBottom: 12 }}>{cancelSuccess}</div>}
      {error && <div className="status-error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading && <SkeletonBookings />}

      {/* Cancel modal overlay */}
      {cancelId && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCancelId(null);
              setCancelReason('');
              setCancelError('');
            }
          }}
        >
          <div className="modal-content" ref={modalRef}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#E24B4A' }}>
              Cancelar cita
            </h3>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>
              Razón (opcional)
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
                placeholder="Motivo de la cancelación..."
                autoFocus
              />
            </label>
            {cancelError && <div className="status-error" style={{ marginTop: 8 }}>{cancelError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={cancelLoading}
                onClick={handleCancel}
                style={{ background: 'var(--danger, #E24B4A)', fontSize: 13 }}
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
        </div>
      )}

      {!loading && (
        <>
          {/* Today's bookings */}
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#5E5C55' }}>
            Hoy ({todayBookings.length})
          </h3>
          {todayBookings.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
              {todayBookings.map((b) => (
                <BookingCard key={b.id} booking={b} isToday onCancel={() => setCancelId(b.id)} onAction={handleQuickAction} />
              ))}
            </div>
          ) : (
            <div className="panel" style={{ padding: 24, textAlign: 'center', marginBottom: 20 }}>
              <CalendarDays size={28} style={{ color: '#9E9B93', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 14, color: '#9E9B93' }}>Sin citas para hoy. ¡Día tranquilo!</p>
            </div>
          )}

          {/* Upcoming bookings */}
          {upcomingBookings.length > 0 && (
            <>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#5E5C55' }}>
                Próximas ({upcomingBookings.length})
              </h3>
              <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                {upcomingBookings.map((b) => (
                  <BookingCard key={b.id} booking={b} onCancel={() => setCancelId(b.id)} onAction={handleQuickAction} />
                ))}
              </div>
            </>
          )}

          {/* Past / Cancelled bookings — collapsible */}
          {pastBookings.length > 0 && (
            <>
              <button
                type="button"
                className="collapsible-toggle"
                onClick={() => setShowPast(!showPast)}
                style={{ marginBottom: 8 }}
              >
                {showPast ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Anteriores / Canceladas ({pastBookings.length})
              </button>
              {showPast && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {pastBookings.map((b) => (
                    <BookingCard key={b.id} booking={b} onAction={handleQuickAction} />
                  ))}
                </div>
              )}
            </>
          )}

          {bookings.length === 0 && (
            <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
              <CalendarDays size={36} style={{ color: '#9E9B93', marginBottom: 10 }} />
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#5E5C55' }}>
                Aún no tienes citas asignadas
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#9E9B93' }}>
                Las citas aparecerán aquí cuando el negocio te asigne reservas.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function BookingCard({
  booking,
  onCancel,
  onAction,
  isToday: todayFlag
}: {
  booking: StaffBooking;
  onCancel?: () => void;
  onAction?: (id: string, action: 'confirm' | 'complete' | 'no-show') => void;
  isToday?: boolean;
}) {
  const meta = statusMeta(booking.status);
  const canCancel =
    onCancel &&
    booking.status !== 'cancelled' &&
    booking.status !== 'completed' &&
    booking.status !== 'no_show';

  const isPast = new Date(booking.startAt) < new Date();
  const borderClass = todayFlag ? 'booking-card-today' : meta.borderClass;

  return (
    <div
      className={`panel ${borderClass}`}
      style={{
        padding: '14px 16px',
        display: 'grid',
        gap: 8
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
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
                borderRadius: 4
              }}
            >
              {meta.label}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#9E9B93' }}>
            {booking.service.name} · {fmt(booking.startAt)} — {fmtTime(booking.endAt)}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9E9B93' }}>{booking.customerEmail}</p>
          {booking.notes && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9E9B93', fontStyle: 'italic' }}>{booking.notes}</p>
          )}
          {booking.cancellationReason && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#E24B4A' }}>
              Razón: {booking.cancellationReason}
            </p>
          )}
        </div>
      </div>
      {/* Action buttons */}
      {onAction && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {booking.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => onAction(booking.id, 'confirm')}
                className="btn btn-ghost"
                style={{ fontSize: 12, color: 'var(--success)', borderColor: '#C8EDE1', padding: '4px 10px' }}
              >
                Confirmar
              </button>
              {canCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: 'var(--danger)', borderColor: '#F7C1C1', padding: '4px 10px' }}
                >
                  Cancelar
                </button>
              )}
            </>
          )}
          {booking.status === 'confirmed' && !isPast && (
            <>
              <button
                type="button"
                onClick={() => onAction(booking.id, 'complete')}
                className="btn btn-ghost"
                style={{ fontSize: 12, color: '#1e3a5f', borderColor: '#bfdbfe', padding: '4px 10px' }}
              >
                Completar
              </button>
              {canCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: 'var(--danger)', borderColor: '#F7C1C1', padding: '4px 10px' }}
                >
                  Cancelar
                </button>
              )}
            </>
          )}
          {(booking.status === 'confirmed' || booking.status === 'rescheduled') && isPast && (
            <>
              <button
                type="button"
                onClick={() => onAction(booking.id, 'complete')}
                className="btn btn-ghost"
                style={{ fontSize: 12, color: '#1e3a5f', borderColor: '#bfdbfe', padding: '4px 10px' }}
              >
                Completar
              </button>
              <button
                type="button"
                onClick={() => onAction(booking.id, 'no-show')}
                className="btn btn-ghost"
                style={{ fontSize: 12, color: '#4b5563', borderColor: '#d1d5db', padding: '4px 10px' }}
              >
                No asistió
              </button>
            </>
          )}
          {/* For other non-terminal states with cancel option */}
          {booking.status !== 'pending' && booking.status !== 'confirmed' && canCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-ghost"
              style={{ fontSize: 12, color: 'var(--danger)', borderColor: '#F7C1C1', padding: '4px 10px' }}
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
