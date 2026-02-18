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

export function OverviewSection(props: OverviewSectionProps) {
  const summaryStatus = props.data ? Object.entries(props.data.summary.byStatus) : [];

  return (
    <>
      <form onSubmit={props.onSubmit} className="section-form" style={{ marginBottom: 20 }}>
        <label>
          API URL
          <input value={props.apiUrl} onChange={(e) => props.setApiUrl(e.target.value)} className="w-full" />
        </label>
        <div className="section-grid section-grid-4">
          <label>
            Rango
            <select value={props.range} onChange={(e) => props.setRange(e.target.value as 'day' | 'week' | 'month')} className="w-full">
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </label>
          <label>
            Fecha base
            <input type="date" value={props.date} onChange={(e) => props.setDate(e.target.value)} className="w-full" />
          </label>
          <label>
            Staff (opcional)
            <select value={props.staffId} onChange={(e) => props.setStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
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
            <select value={props.status} onChange={(e) => props.setStatus(e.target.value)} className="w-full">
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
        <button type="submit" disabled={props.loading || !props.token.trim()} className="btn btn-primary section-button-md">
          {props.loading ? 'Consultando...' : 'Cargar calendario'}
        </button>
      </form>

      <Notice tone="error" message={props.error} withMargin onClose={() => props.setError('')} />
      <Notice tone="error" message={props.reportsError} withMargin onClose={() => props.setReportsError('')} />
      <Notice tone="error" message={props.bookingActionError} withMargin onClose={() => props.setBookingActionError('')} />
      <Notice tone="success" message={props.bookingActionSuccess} withMargin onClose={() => props.setBookingActionSuccess('')} />

      {props.data ? (
        <section className="section-block">
          <div className="section-grid section-grid-3" style={{ marginBottom: 16 }}>
            <article className="panel">
              <strong>Total citas</strong>
              <div>{props.data.summary.totalAppointments}</div>
            </article>
            <article className="panel">
              <strong>Minutos agendados</strong>
              <div>{props.data.summary.totalScheduledMinutes}</div>
            </article>
            <article className="panel">
              <strong>Período</strong>
              <div>{new Date(props.data.period.start).toLocaleString()} → {new Date(props.data.period.end).toLocaleString()}</div>
            </article>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <strong>Estados:</strong>{' '}
            {summaryStatus.length ? summaryStatus.map(([key, value]) => `${key}: ${value}`).join(' | ') : 'Sin datos'}
          </div>

          <div className="table-wrap panel" style={{ padding: 0 }}>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Staff</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {props.data.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{new Date(booking.startAt).toLocaleString()}</td>
                    <td>{new Date(booking.endAt).toLocaleString()}</td>
                    <td>{booking.customerName}</td>
                    <td>{booking.service.name}</td>
                    <td>{booking.staff.fullName}</td>
                    <td>{booking.status}</td>
                    <td>
                      <div className="section-form" style={{ gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            void props.onCancelBooking(booking.id);
                          }}
                          disabled={props.bookingActionLoadingId === booking.id || booking.status === 'cancelled'}
                          className="btn btn-ghost"
                        >
                          {props.bookingActionLoadingId === booking.id ? 'Procesando...' : 'Cancelar'}
                        </button>
                        <input
                          type="datetime-local"
                          value={props.rescheduleDrafts[booking.id] ?? toDateTimeLocalInput(booking.startAt)}
                          onChange={(e) =>
                            props.setRescheduleDrafts((current) => ({
                              ...current,
                              [booking.id]: e.target.value
                            }))
                          }
                          className="w-full"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void props.onRescheduleBooking(booking.id);
                          }}
                          disabled={props.bookingActionLoadingId === booking.id || booking.status === 'cancelled'}
                          className="btn btn-primary"
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
        <section className="section-block" style={{ marginTop: 20 }}>
          <h2 className="section-title">Reportes de negocio (MVP)</h2>
          <div className="section-grid section-grid-4" style={{ marginBottom: 16 }}>
            <article className="panel">
              <strong>Ingresos netos</strong>
              <div>${props.reports.totals.netRevenue.toFixed(2)} MXN</div>
            </article>
            <article className="panel">
              <strong>Canceladas</strong>
              <div>{props.reports.totals.cancelledAppointments}</div>
            </article>
            <article className="panel">
              <strong>Tasa cancelación</strong>
              <div>{props.reports.totals.cancellationRate}%</div>
            </article>
            <article className="panel">
              <strong>Total citas</strong>
              <div>{props.reports.totals.totalAppointments}</div>
            </article>
          </div>

          <div className="section-grid section-grid-3">
            <article className="panel">
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

            <article className="panel">
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

            <article className="panel">
              <strong>Horas pico ({props.reports.timeZone ?? 'UTC'})</strong>
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
