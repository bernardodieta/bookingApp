import { Notice } from './notice';

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
    summary: { totalAppointments: number; totalScheduledMinutes: number };
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
  summaryStatus: Array<[string, number]>;

  onCancelBooking: (bookingId: string) => Promise<void>;
  onRescheduleBooking: (bookingId: string) => Promise<void>;
  bookingActionLoadingId: string;
  rescheduleDrafts: Record<string, string>;
  setRescheduleDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  toDateTimeLocalInput: (value: string) => string;

  reports: {
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

export function OverviewSection(props: OverviewSectionProps) {
  return (
    <>
      <form onSubmit={props.onSubmit} style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        <label>
          API URL
          <input value={props.apiUrl} onChange={(e) => props.setApiUrl(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <label>
            Rango
            <select value={props.range} onChange={(e) => props.setRange(e.target.value as 'day' | 'week' | 'month')} style={{ width: '100%' }}>
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </label>
          <label>
            Fecha base
            <input type="date" value={props.date} onChange={(e) => props.setDate(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Staff (opcional)
            <select value={props.staffId} onChange={(e) => props.setStaffId(e.target.value)} style={{ width: '100%' }} disabled={props.staffLoading}>
              <option value="">Todos</option>
              {props.staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado (opcional)
            <select value={props.status} onChange={(e) => props.setStatus(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todos</option>
              {props.statusOptions.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Notice tone="warning" message={props.staffError} onClose={() => props.setStaffError('')} />
        <Notice tone="warning" message={props.serviceError} onClose={() => props.setServiceError('')} />
        <button type="submit" disabled={props.loading || !props.token.trim()} style={{ width: 220, padding: '8px 12px' }}>
          {props.loading ? 'Consultando...' : 'Cargar calendario'}
        </button>
      </form>

      <Notice tone="error" message={props.error} withMargin onClose={() => props.setError('')} />
      <Notice tone="error" message={props.reportsError} withMargin onClose={() => props.setReportsError('')} />
      <Notice tone="error" message={props.bookingActionError} withMargin onClose={() => props.setBookingActionError('')} />
      <Notice tone="success" message={props.bookingActionSuccess} withMargin onClose={() => props.setBookingActionSuccess('')} />

      {props.data ? (
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Total citas</strong>
              <div>{props.data.summary.totalAppointments}</div>
            </article>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Minutos agendados</strong>
              <div>{props.data.summary.totalScheduledMinutes}</div>
            </article>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Período</strong>
              <div>{new Date(props.data.period.start).toLocaleString()} → {new Date(props.data.period.end).toLocaleString()}</div>
            </article>
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Estados:</strong>{' '}
            {props.summaryStatus.length ? props.summaryStatus.map(([key, value]) => `${key}: ${value}`).join(' | ') : 'Sin datos'}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Inicio</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Fin</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Cliente</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Servicio</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Staff</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Estado</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {props.data.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{new Date(booking.startAt).toLocaleString()}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{new Date(booking.endAt).toLocaleString()}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.customerName}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.service.name}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.staff.fullName}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.status}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            void props.onCancelBooking(booking.id);
                          }}
                          disabled={props.bookingActionLoadingId === booking.id || booking.status === 'cancelled'}
                          style={{ width: 120, padding: '6px 8px' }}
                        >
                          {props.bookingActionLoadingId === booking.id ? 'Procesando...' : 'Cancelar'}
                        </button>
                        <input
                          type="datetime-local"
                          value={props.rescheduleDrafts[booking.id] ?? props.toDateTimeLocalInput(booking.startAt)}
                          onChange={(e) =>
                            props.setRescheduleDrafts((current) => ({
                              ...current,
                              [booking.id]: e.target.value
                            }))
                          }
                          style={{ width: '100%' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void props.onRescheduleBooking(booking.id);
                          }}
                          disabled={props.bookingActionLoadingId === booking.id || booking.status === 'cancelled'}
                          style={{ width: 120, padding: '6px 8px' }}
                        >
                          {props.bookingActionLoadingId === booking.id ? 'Procesando...' : 'Reprogramar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {props.reports ? (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 8 }}>Reportes de negocio (MVP)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Ingresos netos</strong>
              <div>${props.reports.totals.netRevenue.toFixed(2)} MXN</div>
            </article>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Canceladas</strong>
              <div>{props.reports.totals.cancelledAppointments}</div>
            </article>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Tasa cancelación</strong>
              <div>{props.reports.totals.cancellationRate}%</div>
            </article>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Total citas</strong>
              <div>{props.reports.totals.totalAppointments}</div>
            </article>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Clientes frecuentes</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {props.reports.topCustomers.length ? (
                  props.reports.topCustomers.map((entry) => (
                    <li key={entry.customerEmail}>
                      {entry.customerName} ({entry.totalBookings})
                    </li>
                  ))
                ) : (
                  <li>Sin datos</li>
                )}
              </ul>
            </article>

            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Servicios más demandados</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {props.reports.topServices.length ? (
                  props.reports.topServices.map((entry) => (
                    <li key={entry.serviceId}>
                      {entry.serviceName} ({entry.totalBookings})
                    </li>
                  ))
                ) : (
                  <li>Sin datos</li>
                )}
              </ul>
            </article>

            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Horas pico (UTC)</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {props.reports.peakHours.length ? (
                  props.reports.peakHours.map((entry) => (
                    <li key={entry.hour}>
                      {String(entry.hour).padStart(2, '0')}:00 ({entry.total})
                    </li>
                  ))
                ) : (
                  <li>Sin datos</li>
                )}
              </ul>
            </article>
          </div>
        </section>
      ) : null}
    </>
  );
}
