'use client';

import { FormEvent, useState } from 'react';

type Booking = {
  id: string;
  status: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  cancellationReason: string | null;
  customer?: { name: string; email: string } | null;
  service?: { name: string } | null;
  staff?: { fullName: string } | null;
};

type ReportData = {
  total: number;
  from: string;
  to: string;
  bookings: Booking[];
};

type StaffMember = { id: string; fullName: string };

interface Props {
  apiUrl: string;
  token: string;
  staffOptions: StaffMember[];
}

const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .slice(0, 10);

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  pending: 'Pendiente',
};

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(bookings: Booking[]): string {
  const headers = [
    'ID',
    'Cliente',
    'Email',
    'Servicio',
    'Profesional',
    'Estado',
    'Inicio',
    'Fin',
    'Duración (min)',
    'Notas',
    'Motivo cancelación',
  ];

  const rows = bookings.map((b) => {
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    const durationMin = Math.round((end.getTime() - start.getTime()) / 60_000);
    return [
      b.id,
      b.customer?.name ?? '',
      b.customer?.email ?? '',
      b.service?.name ?? '',
      b.staff?.fullName ?? '',
      STATUS_LABELS[b.status] ?? b.status,
      start.toLocaleString('es-MX'),
      end.toLocaleString('es-MX'),
      String(durationMin),
      b.notes ?? '',
      b.cancellationReason ?? '',
    ].map(escapeCsv).join(',');
  });

  // BOM for Excel UTF-8 compat
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReporteSection({ apiUrl, token, staffOptions }: Props) {
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [staffId, setStaffId] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchReport(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setData(null);
    try {
      const url = new URL('/dashboard/full-report', apiUrl);
      if (from) url.searchParams.set('from', from);
      if (to) url.searchParams.set('to', to);
      if (staffId) url.searchParams.set('staffId', staffId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const json = (await res.json()) as ReportData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!data?.bookings?.length) return;
    const csv = buildCsv(data.bookings);
    const label = `reporte_${from}_${to}`;
    downloadCsv(csv, `${label}.csv`);
  }

  const byStatus = (status: string) => data?.bookings.filter((b) => b.status === status).length ?? 0;

  return (
    <section className="section-block">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>Reporte de citas</h2>
          <p className="section-subtitle" style={{ margin: '4px 0 0' }}>
            Descarga un CSV con todas las citas en el período seleccionado.
          </p>
        </div>
        {data?.bookings.length ? (
          <button type="button" onClick={handleDownload} className="btn btn-primary">
            ↓ Descargar CSV
          </button>
        ) : null}
      </div>

      {/* Filters */}
      <form onSubmit={fetchReport} className="section-form" style={{ marginBottom: 14 }}>
        <div className="section-grid">
          <label>
            Desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full" />
          </label>
          <label>
            Hasta
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full" />
          </label>
          <label>
            Profesional
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full">
              <option value="">Todos</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="section-actions">
          <button type="submit" disabled={loading} className="btn btn-primary section-button-md">
            {loading ? 'Generando...' : 'Generar reporte'}
          </button>
        </div>
      </form>

      {error ? (
        <div className="panel" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {/* Summary cards */}
      {data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total citas', value: data.total, color: '#0f172a', bg: '#f8fafc' },
              { label: 'Confirmadas', value: byStatus('confirmed'), color: '#1d4ed8', bg: '#eff6ff' },
              { label: 'Completadas', value: byStatus('completed'), color: '#15803d', bg: '#f0fdf4' },
              { label: 'Canceladas',  value: byStatus('cancelled'),  color: '#b91c1c', bg: '#fef2f2' },
            ].map((card) => (
              <div key={card.label} className="panel" style={{ padding: '12px 16px', background: card.bg, borderColor: 'transparent' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{card.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div className="panel table-wrap" style={{ padding: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Vista previa — {data.total} citas</span>
              {data.bookings.length ? (
                <button type="button" onClick={handleDownload} className="btn btn-ghost" style={{ fontSize: 12 }}>
                  ↓ Descargar CSV
                </button>
              ) : null}
            </div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Inicio</th>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Profesional</th>
                  <th>Estado</th>
                  <th>Motivo cancelación</th>
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((b) => (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleString('es-MX')}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{b.customer?.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{b.customer?.email ?? ''}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{b.service?.name ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{b.staff?.fullName ?? '—'}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: b.status === 'cancelled' ? '#fef2f2' : b.status === 'completed' ? '#f0fdf4' : '#eff6ff',
                        color: b.status === 'cancelled' ? '#b91c1c' : b.status === 'completed' ? '#15803d' : '#1d4ed8'
                      }}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b', maxWidth: 220 }}>
                      {b.cancellationReason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.bookings.length ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8' }}>
                Sin citas en el período seleccionado.
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
