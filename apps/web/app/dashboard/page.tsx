'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type StaffMember = {
  id: string;
  fullName: string;
};

type DashboardResponse = {
  range: 'day' | 'week' | 'month';
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalAppointments: number;
    totalScheduledMinutes: number;
    byStatus: Record<string, number>;
    byStaff: Record<string, number>;
  };
  bookings: Array<{
    id: string;
    customerName: string;
    customerEmail: string;
    status: string;
    startAt: string;
    endAt: string;
    service: { name: string };
    staff: { fullName: string };
  }>;
};

const TOKEN_KEY = 'apoint.dashboard.token';
const API_URL_KEY = 'apoint.dashboard.apiUrl';
const today = new Date().toISOString().slice(0, 10);
const STATUS_OPTIONS = ['pending', 'confirmed', 'cancelled', 'rescheduled', 'no_show', 'completed'] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState('http://localhost:3001');
  const [token, setToken] = useState('');
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const [date, setDate] = useState(today);
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState('');
  const [staffOptions, setStaffOptions] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardResponse | null>(null);

  const summaryStatus = useMemo(() => {
    if (!data) return [] as Array<[string, number]>;
    return Object.entries(data.summary.byStatus);
  }, [data]);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedApiUrl = localStorage.getItem(API_URL_KEY);

    if (!storedToken) {
      router.replace('/login');
      return;
    }

    setToken(storedToken);
    if (storedApiUrl) {
      setApiUrl(storedApiUrl);
    }
  }, [router]);

  useEffect(() => {
    if (apiUrl.trim()) {
      localStorage.setItem(API_URL_KEY, apiUrl.trim());
    }
  }, [apiUrl]);

  useEffect(() => {
    if (!token.trim()) {
      return;
    }

    let cancelled = false;

    async function loadStaff() {
      setStaffLoading(true);
      setStaffError('');

      try {
        const response = await fetch(new URL('/staff', apiUrl).toString(), {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Error ${response.status}`);
        }

        const payload = (await response.json()) as StaffMember[];
        if (cancelled) {
          return;
        }

        setStaffOptions(payload);
        if (payload.length && !payload.some((entry) => entry.id === staffId)) {
          setStaffId('');
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar staff';
        setStaffError(message);
      } finally {
        if (!cancelled) {
          setStaffLoading(false);
        }
      }
    }

    loadStaff();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, token]);

  function onLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setData(null);
    router.replace('/login');
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = new URL('/dashboard/appointments', apiUrl);
      url.searchParams.set('range', range);
      url.searchParams.set('date', date);
      if (staffId.trim()) {
        url.searchParams.set('staffId', staffId.trim());
      }
      if (status.trim()) {
        url.searchParams.set('status', status.trim());
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as DashboardResponse;
      setData(payload);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Error inesperado';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>Apoint Dashboard (MVP)</h1>
      <p style={{ marginTop: 0, color: '#555' }}>Calendario operativo día/semana/mes consumiendo API real.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={onLogout} style={{ padding: '8px 12px' }}>
          Logout
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        <label>
          API URL
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <label>
            Rango
            <select value={range} onChange={(e) => setRange(e.target.value as 'day' | 'week' | 'month')} style={{ width: '100%' }}>
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </label>
          <label>
            Fecha base
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Staff (opcional)
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ width: '100%' }} disabled={staffLoading}>
              <option value="">Todos</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado (opcional)
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        </div>
        {staffError ? <div style={{ background: '#fff4e5', color: '#8a5300', padding: 10, borderRadius: 6 }}>{staffError}</div> : null}
        <button type="submit" disabled={loading || !token.trim()} style={{ width: 220, padding: '8px 12px' }}>
          {loading ? 'Consultando...' : 'Cargar calendario'}
        </button>
      </form>

      {error ? (
        <div style={{ background: '#fee', color: '#900', padding: 12, borderRadius: 6, marginBottom: 16 }}>{error}</div>
      ) : null}

      {data ? (
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Total citas</strong>
              <div>{data.summary.totalAppointments}</div>
            </article>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Minutos agendados</strong>
              <div>{data.summary.totalScheduledMinutes}</div>
            </article>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Período</strong>
              <div>{new Date(data.period.start).toLocaleString()} → {new Date(data.period.end).toLocaleString()}</div>
            </article>
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Estados:</strong>{' '}
            {summaryStatus.length ? summaryStatus.map(([key, value]) => `${key}: ${value}`).join(' | ') : 'Sin datos'}
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
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{new Date(booking.startAt).toLocaleString()}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{new Date(booking.endAt).toLocaleString()}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.customerName}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.service.name}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.staff.fullName}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
