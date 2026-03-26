import { Notice } from './notice';
import { toDateTimeLocalInput } from '../dashboard-utils';

type OverviewSectionProps = {
  onSubmit: (event: React.FormEvent) => Promise<void>;
  apiUrl: string;
  setApiUrl: (value: string) => void;
  range: 'day' | 'week' | 'month';
  setRange: (value: 'day' | 'week' | 'month') => void;
  date: string;
  setDate: (value: string) => void;
  staffId: string;
  setStaffId: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  staffLoading: boolean;
  staffOptions: Array<{ id: string; fullName: string }>;
  statusOptions: readonly string[];
  staffError: string;
  setStaffError: (value: string) => void;
  serviceError: string;
  setServiceError: (value: string) => void;
  loading: boolean;
  token: string;

  error: string;
  setError: (value: string) => void;
  reportsError: string;
  setReportsError: (value: string) => void;
  bookingActionError: string;
  setBookingActionError: (value: string) => void;
  bookingActionSuccess: string;
  setBookingActionSuccess: (value: string) => void;

  data: {
    period: { start: string; end: string };
    summary: { totalAppointments: number; totalScheduledMinutes: number; byStatus: Record<string, number> };
    bookings: Array<{
      id: string;
      customerName: string;
      status: string;
      startAt: string;
      endAt: string;
      service: { name: string };
      staff: { fullName: string };
    }>;
  } | null;

  onCancelBooking: (bookingId: string) => Promise<void>;
  onRescheduleBooking: (bookingId: string) => Promise<void>;
  bookingActionLoadingId: string;
  rescheduleDrafts: Record<string, string>;
  setRescheduleDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  reports: {
    timeZone?: string;
    totals: {
      netRevenue: number;
      cancelledAppointments: number;
      cancellationRate: number;
      totalAppointments: number;
    };
    topCustomers: Array<{
      customerEmail: string;
      customerName: string;
      totalBookings: number;
    }>;
    topServices: Array<{
      serviceId: string;
      serviceName: string;
      totalBookings: number;
    }>;
    peakHours: Array<{
      hour: number;
      total: number;
    }>;
  } | null;
};

const RANGE_LABEL: Record<string, string> = { day: 'Hoy', week: 'Esta semana', month: 'Este mes' };

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendiente',  color: '#BA7517', bg: '#FAEEDA' },
  confirmed: { label: 'Confirmada', color: '#0D5C44', bg: '#EFF8F5' },
  cancelled: { label: 'Cancelada',  color: '#E24B4A', bg: '#FCEBEB' },
  completed: { label: 'Completada', color: '#1e3a5f', bg: '#dbeafe' },
  no_show:   { label: 'No asistió', color: '#4b5563', bg: '#f3f4f6' }
};

function statusBadge(s: string) {
  const meta = STATUS_META[s] ?? { label: s, color: '#555', bg: '#f5f5f5' };
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 4,
        padding: '2px 10px',
        color: meta.color,
        background: meta.bg,
        whiteSpace: 'nowrap'
      }}
    >
      {meta.label}
    </span>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { timeStyle: 'short' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function OverviewSection(props: OverviewSectionProps) {
  const summaryStatus = props.data ? Object.entries(props.data.summary.byStatus) : [];
  const bookings = props.data?.bookings ?? [];
  const hasData = !!props.data;

  return (
    <section className="section-block" style={{ marginTop: 28 }}>
      <h2 className="section-title">Resumen</h2>

      {/* ── Filter bar ── */}
      <form
        onSubmit={props.onSubmit}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'flex-end',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px'
        }}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: 13, flex: '0 1 120px' }}>
          <span style={{ fontWeight: 500, color: '#5E5C55' }}>Rango</span>
          <select value={props.range} onChange={(e) => props.setRange(e.target.value as 'day' | 'week' | 'month')} className="w-full">
            <option value="day">Hoy</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, flex: '0 1 150px' }}>
          <span style={{ fontWeight: 500, color: '#5E5C55' }}>Fecha</span>
          <input type="date" value={props.date} onChange={(e) => props.setDate(e.target.value)} className="w-full" />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, flex: '1 1 150px' }}>
          <span style={{ fontWeight: 500, color: '#5E5C55' }}>Profesional</span>
          <select value={props.staffId} onChange={(e) => props.setStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
            <option value="">Todos</option>
            {props.staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>{staff.fullName}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, flex: '0 1 130px' }}>
          <span style={{ fontWeight: 500, color: '#5E5C55' }}>Estado</span>
          <select value={props.status} onChange={(e) => props.setStatus(e.target.value)} className="w-full">
            <option value="">Todos</option>
            {props.statusOptions.map((entry) => (
              <option key={entry} value={entry}>{STATUS_META[entry]?.label ?? entry}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={props.loading || !props.token.trim()} className="btn btn-primary" style={{ height: 38, alignSelf: 'flex-end' }}>
          {props.loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </form>

      <Notice tone="warning" message={props.staffError} onClose={() => props.setStaffError('')} />
      <Notice tone="warning" message={props.serviceError} onClose={() => props.setServiceError('')} />
      <Notice tone="error" message={props.error} onClose={() => props.setError('')} />
      <Notice tone="error" message={props.reportsError} onClose={() => props.setReportsError('')} />
      <Notice tone="error" message={props.bookingActionError} onClose={() => props.setBookingActionError('')} />
      <Notice tone="success" message={props.bookingActionSuccess} onClose={() => props.setBookingActionSuccess('')} />

      {/* ── Loading skeleton ── */}
      {props.loading && !hasData ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="section-grid section-grid-4">
            <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
          </div>
          <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
        </div>
      ) : null}

      {/* ── Stats cards ── */}
      {hasData ? (
        <>
          <div className="stats-strip">
            <div className="stat-card">
              <div>
                <div className="stat-label">Total citas</div>
                <div className="stat-value">{props.data!.summary.totalAppointments}</div>
              </div>
            </div>
            <div className="stat-card">
              <div>
                <div className="stat-label">Minutos agendados</div>
                <div className="stat-value">{props.data!.summary.totalScheduledMinutes}</div>
              </div>
            </div>
            {summaryStatus.map(([key, value]) => (
              <div className="stat-card" key={key}>
                <div>
                  <div className="stat-label">{STATUS_META[key]?.label ?? key}</div>
                  <div className="stat-value">{value as number}</div>
                </div>
                <div>{statusBadge(key)}</div>
              </div>
            ))}
          </div>

          {/* ── Bookings list ── */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 8px', borderBottom: '1.5px solid var(--border)' }}>
              <strong style={{ fontSize: '0.95rem' }}>
                Citas &mdash; {RANGE_LABEL[props.range] ?? props.range}
              </strong>
              <span style={{ fontSize: 12, color: '#9E9B93', marginLeft: 8 }}>
                {bookings.length} {bookings.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>

            {bookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9E9B93', fontSize: 14 }}>
                No hay citas en este período.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 0 }}>
                {bookings.map((booking, idx) => {
                  const isCancelled = booking.status === 'cancelled';
                  const borderClass =
                    booking.status === 'confirmed' ? 'booking-card-confirmed'
                    : booking.status === 'pending' ? 'booking-card-pending'
                    : booking.status === 'cancelled' ? 'booking-card-cancelled'
                    : booking.status === 'completed' ? 'booking-card-completed'
                    : '';
                  return (
                    <div
                      key={booking.id}
                      className={borderClass}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 18px',
                        borderBottom: idx < bookings.length - 1 ? '1.5px solid var(--border)' : 'none',
                        opacity: isCancelled ? 0.6 : 1
                      }}
                    >
                      {/* Time block */}
                      <div style={{ minWidth: 80, flexShrink: 0, textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{fmtTime(booking.startAt)}</div>
                        <div style={{ fontSize: 11, color: '#9E9B93' }}>{fmtDate(booking.startAt)}</div>
                      </div>

                      {/* Divider */}
                      <div style={{ width: 1, height: 36, background: 'var(--border)', flexShrink: 0 }} />

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{booking.customerName}</div>
                        <div style={{ fontSize: 13, color: '#9E9B93', marginTop: 2 }}>
                          {booking.service.name} &middot; {booking.staff.fullName}
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{ flexShrink: 0 }}>{statusBadge(booking.status)}</div>

                      {/* Actions */}
                      {!isCancelled && booking.status !== 'completed' && booking.status !== 'no_show' ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                          <input
                            type="datetime-local"
                            value={props.rescheduleDrafts[booking.id] ?? toDateTimeLocalInput(booking.startAt)}
                            onChange={(e) =>
                              props.setRescheduleDrafts((current) => ({
                                ...current,
                                [booking.id]: e.target.value
                              }))
                            }
                            style={{ fontSize: 12, padding: '5px 8px', borderRadius: 8, width: 170 }}
                          />
                          <button
                            type="button"
                            onClick={() => { void props.onRescheduleBooking(booking.id); }}
                            disabled={props.bookingActionLoadingId === booking.id}
                            className="btn btn-ghost"
                            style={{ fontSize: 12, padding: '5px 12px' }}
                          >
                            Mover
                          </button>
                          <button
                            type="button"
                            onClick={() => { void props.onCancelBooking(booking.id); }}
                            disabled={props.bookingActionLoadingId === booking.id}
                            className="btn btn-ghost"
                            style={{ fontSize: 12, padding: '5px 12px', color: 'var(--danger)' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* ── Reports section ── */}
      {props.reports ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Indicadores del negocio</h3>

          <div className="section-grid section-grid-4">
            <div className="stat-card">
              <div>
                <div className="stat-label">Ingresos netos</div>
                <div className="stat-value" style={{ fontSize: 20 }}>${props.reports.totals.netRevenue.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card">
              <div>
                <div className="stat-label">Cancelaciones</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{props.reports.totals.cancelledAppointments}</div>
              </div>
            </div>
            <div className="stat-card">
              <div>
                <div className="stat-label">Tasa cancelación</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{props.reports.totals.cancellationRate}%</div>
              </div>
            </div>
            <div className="stat-card">
              <div>
                <div className="stat-label">Total citas</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{props.reports.totals.totalAppointments}</div>
              </div>
            </div>
          </div>

          <div className="section-grid section-grid-3">
            <div className="panel" style={{ padding: '16px 18px' }}>
              <strong style={{ fontSize: 13, color: '#5E5C55' }}>Clientes frecuentes</strong>
              {props.reports.topCustomers.length ? (
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {props.reports.topCustomers.map((entry) => (
                    <div key={entry.customerEmail} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text)' }}>{entry.customerName}</span>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{entry.totalBookings}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 13, color: '#9E9B93' }}>Sin datos</div>
              )}
            </div>

            <div className="panel" style={{ padding: '16px 18px' }}>
              <strong style={{ fontSize: 13, color: '#5E5C55' }}>Servicios populares</strong>
              {props.reports.topServices.length ? (
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {props.reports.topServices.map((entry) => (
                    <div key={entry.serviceId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text)' }}>{entry.serviceName}</span>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{entry.totalBookings}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 13, color: '#9E9B93' }}>Sin datos</div>
              )}
            </div>

            <div className="panel" style={{ padding: '16px 18px' }}>
              <strong style={{ fontSize: 13, color: '#5E5C55' }}>Horas pico</strong>
              {props.reports.peakHours.length ? (
                <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
                  {props.reports.peakHours.map((entry) => {
                    const maxTotal = Math.max(...props.reports!.peakHours.map((h) => h.total), 1);
                    const pct = Math.round((entry.total / maxTotal) * 100);
                    return (
                      <div key={entry.hour} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ width: 46, textAlign: 'right', fontWeight: 500, flexShrink: 0 }}>
                          {String(entry.hour).padStart(2, '0')}:00
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#D8D5CF', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'var(--primary)' }} />
                        </div>
                        <span style={{ width: 24, fontWeight: 600, color: 'var(--primary)', fontSize: 12 }}>{entry.total}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 13, color: '#9E9B93' }}>Sin datos</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
