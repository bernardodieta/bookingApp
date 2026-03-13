'use client';

import { FormEvent, useEffect, useState } from 'react';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'business';
  customDomain: string | null;
  widgetEnabled: boolean;
  ownerEmail: string | null;
  bookingsCount: number;
  staffCount: number;
  servicesCount: number;
  customersCount: number;
  createdAt: string;
};

type AuditEntry = {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorUserId: string | null;
};

type ActiveView = 'tenants' | 'audit';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const PLAN_META = {
  free:     { label: 'Free',     color: '#64748b', bg: '#f1f5f9', limits: '50 citas/mes · 1 staff' },
  pro:      { label: 'Pro',      color: '#2563eb', bg: '#eff6ff', limits: 'Ilimitado · 5 staff' },
  business: { label: 'Business', color: '#7c3aed', bg: '#f5f3ff', limits: 'Ilimitado · staff ilimitado' }
} as const;

function PlanBadge({ plan }: { plan: Tenant['plan'] }) {
  const m = PLAN_META[plan];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
}

const today = new Date().toISOString().slice(0, 10);

export default function SuperAdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('tenants');

  // Tenants state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [newPlan, setNewPlan] = useState<Tenant['plan']>('free');
  const [customDomain, setCustomDomain] = useState('');
  const [creating, setCreating] = useState(false);

  // Audit state
  const [auditTenantId, setAuditTenantId] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditFrom, setAuditFrom] = useState(today);
  const [auditTo, setAuditTo] = useState(today);
  const [auditLimit, setAuditLimit] = useState('50');
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  function headers() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` };
  }

  async function loadTenants(adminSecret: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/tenants`, {
        headers: { Authorization: `Bearer ${adminSecret}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const data = (await res.json()) as Tenant[];
      setTenants(data);
      setAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    await loadTenants(secret);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tenants`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          tenantName,
          ownerEmail,
          ownerPassword,
          plan: newPlan,
          customDomain: customDomain.trim() || undefined
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      setSuccess(`Tenant "${tenantName}" creado correctamente.`);
      setTenantName('');
      setOwnerEmail('');
      setOwnerPassword('');
      setCustomDomain('');
      setNewPlan('free');
      setShowCreate(false);
      await loadTenants(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el tenant');
    } finally {
      setCreating(false);
    }
  }

  async function handleChangePlan(tenantId: string, plan: Tenant['plan']) {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/tenants/${tenantId}/plan`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ plan })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      setTenants((prev) => prev.map((t) => (t.id === tenantId ? { ...t, plan } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el plan');
    }
  }

  async function handleDelete(tenantId: string, name: string) {
    if (!window.confirm(`¿Eliminar permanentemente el tenant "${name}"? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: headers()
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      setTenants((prev) => prev.filter((t) => t.id !== tenantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el tenant');
    }
  }

  async function loadAudit(cursor?: string) {
    setAuditLoading(true);
    setAuditError('');
    try {
      const url = new URL('/audit/logs', API_BASE);
      if (auditTenantId.trim()) url.searchParams.set('tenantId', auditTenantId.trim());
      if (auditAction.trim()) url.searchParams.set('action', auditAction.trim());
      if (auditFrom) url.searchParams.set('from', `${auditFrom}T00:00:00.000Z`);
      if (auditTo) url.searchParams.set('to', `${auditTo}T23:59:59.999Z`);
      url.searchParams.set('limit', auditLimit || '50');
      if (cursor) url.searchParams.set('cursor', cursor);

      // Use the super-admin secret as Bearer to hit the audit endpoint cross-tenant
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${secret}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const data = (await res.json()) as { items: AuditEntry[]; nextCursor?: string };
      setAuditLogs(data.items ?? []);
      setAuditCursor(data.nextCursor ?? null);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'No se pudo cargar auditoría');
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    if (!authed || !secret) return;
    const interval = setInterval(() => { void loadTenants(secret); }, 30_000);
    return () => clearInterval(interval);
  }, [authed, secret]);

  // ── Auth gate ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #f6f8fc)', padding: 24 }}>
        <div className="panel" style={{ width: '100%', maxWidth: 380, display: 'grid', gap: 20, padding: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Super Admin</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>Panel de administración de tenants</p>
          </div>
          <form onSubmit={handleAuth} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Clave de super-admin
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoFocus
                placeholder="SUPER_ADMIN_SECRET"
                className="w-full"
              />
            </label>
            <button type="submit" disabled={loading || !secret} className="btn btn-primary">
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
            {error ? <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#b91c1c' }}>{error}</div> : null}
          </form>
        </div>
      </div>
    );
  }

  // ── Admin panel ──────────────────────────────────────────────────────────
  return (
    <main className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar surface">
        <div className="sidebar-brand">
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
            🔐
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Super Admin</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Panel de sistema</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-item ${activeView === 'tenants' ? 'active' : ''}`}
            onClick={() => setActiveView('tenants')}
          >
            <span style={{ fontSize: 14 }}>🏢</span>
            <span>Tenants</span>
          </button>
          <button
            type="button"
            className={`sidebar-item ${activeView === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveView('audit')}
          >
            <span style={{ fontSize: 14 }}>📋</span>
            <span>Auditoría</span>
          </button>
        </nav>

        <div style={{ marginTop: 'auto', padding: '12px 8px' }}>
          <button
            type="button"
            className="sidebar-item"
            onClick={() => { setAuthed(false); setSecret(''); setTenants([]); }}
            style={{ width: '100%', color: '#dc2626' }}
          >
            <span style={{ fontSize: 14 }}>↩</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <section className="dashboard-main">
        <div style={{ maxWidth: 1100, padding: '28px 24px' }}>

          {/* ── TENANTS VIEW ── */}
          {activeView === 'tenants' ? (
            <>
              <section className="section-block">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <h2 className="section-title" style={{ margin: 0 }}>Gestión de Tenants</h2>
                    <p className="section-subtitle" style={{ margin: '4px 0 0' }}>{tenants.length} tenants registrados</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => void loadTenants(secret)} disabled={loading} className="btn btn-ghost">
                      {loading ? '...' : '↻ Recargar'}
                    </button>
                    <button type="button" onClick={() => setShowCreate(!showCreate)} className="btn btn-primary">
                      + Nuevo tenant
                    </button>
                  </div>
                </div>

                {/* Feedback */}
                {error ? <div className="panel" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</div> : null}
                {success ? <div className="panel" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontSize: 13, marginBottom: 12 }}>{success}</div> : null}

                {/* Create form */}
                {showCreate ? (
                  <div className="panel" style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Crear nuevo tenant</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                      <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        Nombre del negocio *
                        <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} required placeholder="Consultorio Dra. García" className="w-full" />
                      </label>
                      <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        Email del dueño *
                        <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required placeholder="owner@negocio.com" className="w-full" />
                      </label>
                      <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        Contraseña inicial *
                        <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required minLength={8} className="w-full" />
                      </label>
                      <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        Plan
                        <select value={newPlan} onChange={(e) => setNewPlan(e.target.value as Tenant['plan'])} className="w-full">
                          <option value="free">Free — 50 citas/mes, 1 staff</option>
                          <option value="pro">Pro — Ilimitado, 5 staff</option>
                          <option value="business">Business — Todo ilimitado</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        Dominio personalizado (opcional)
                        <input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="agenda.mi-negocio.com" className="w-full" />
                      </label>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        <button type="submit" disabled={creating} className="btn btn-primary">
                          {creating ? 'Creando...' : 'Crear tenant'}
                        </button>
                        <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}

                {/* Plan summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
                  {Object.entries(PLAN_META).map(([key, m]) => {
                    const count = tenants.filter((t) => t.plan === key).length;
                    return (
                      <div key={key} className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: m.color, fontSize: 13 }}>{m.label}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{m.limits}</div>
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 800 }}>{count}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Tenant table */}
                <div className="panel table-wrap" style={{ padding: 0 }}>
                  <table className="table-base">
                    <thead>
                      <tr>
                        {['Negocio', 'Slug', 'Plan', 'Owner', 'Citas', 'Staff', 'Dominio', 'Creado', 'Acciones'].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td>
                            <a href={`/public/${t.slug}`} target="_blank" rel="noreferrer"
                              style={{ color: 'var(--primary)', textDecoration: 'none', fontFamily: 'monospace', fontSize: 12 }}>
                              {t.slug}
                            </a>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <PlanBadge plan={t.plan} />
                              <select
                                value={t.plan}
                                onChange={(e) => void handleChangePlan(t.id, e.target.value as Tenant['plan'])}
                                style={{ fontSize: 11, padding: '2px 4px', borderRadius: 5, border: '1px solid var(--border)' }}
                              >
                                <option value="free">free</option>
                                <option value="pro">pro</option>
                                <option value="business">business</option>
                              </select>
                            </div>
                          </td>
                          <td style={{ color: '#64748b', fontSize: 12 }}>{t.ownerEmail ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>{t.bookingsCount}</td>
                          <td style={{ textAlign: 'center' }}>{t.staffCount}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11, color: t.customDomain ? 'var(--primary)' : '#94a3b8' }}>
                            {t.customDomain ?? '—'}
                          </td>
                          <td style={{ color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>
                            {new Date(t.createdAt).toLocaleDateString('es-MX')}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => void handleDelete(t.id, t.name)}
                              className="btn btn-ghost"
                              style={{ fontSize: 11, color: '#dc2626', borderColor: '#fca5a5' }}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!tenants.length && !loading ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      No hay tenants registrados. Crea el primero.
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          {/* ── AUDIT VIEW ── */}
          {activeView === 'audit' ? (
            <section className="section-block">
              <h2 className="section-title">Auditoría del sistema</h2>
              <p className="section-subtitle">Consulta logs de acciones de cualquier tenant.</p>

              <form
                onSubmit={(e) => { e.preventDefault(); void loadAudit(); }}
                className="section-form"
                style={{ marginBottom: 14 }}
              >
                <div className="section-grid section-grid-4">
                  <label>
                    Tenant
                    <select value={auditTenantId} onChange={(e) => setAuditTenantId(e.target.value)} className="w-full">
                      <option value="">Todos los tenants</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Acción (opcional)
                    <input value={auditAction} onChange={(e) => setAuditAction(e.target.value)} placeholder="BOOKING_CREATED" className="w-full" />
                  </label>
                  <label>
                    Desde
                    <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} className="w-full" />
                  </label>
                  <label>
                    Hasta
                    <input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} className="w-full" />
                  </label>
                </div>
                <div className="section-actions">
                  <button type="submit" disabled={auditLoading} className="btn btn-primary section-button-md">
                    {auditLoading ? 'Cargando...' : 'Consultar'}
                  </button>
                  <button
                    type="button"
                    disabled={auditLoading || !auditCursor}
                    onClick={() => { if (auditCursor) void loadAudit(auditCursor); }}
                    className="btn btn-ghost section-button-md"
                  >
                    Siguiente página
                  </button>
                </div>
              </form>

              {auditError ? <div className="panel" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{auditError}</div> : null}

              <div className="panel table-wrap" style={{ padding: 0 }}>
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tenant</th>
                      <th>Acción</th>
                      <th>Entidad</th>
                      <th>Entity ID</th>
                      <th>Actor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((entry) => (
                      <tr key={entry.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(entry.createdAt).toLocaleString('es-MX')}</td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>
                          {tenants.find((t) => t.id === (entry as unknown as Record<string,string>).tenantId)?.name ?? (entry as unknown as Record<string,string>).tenantId ?? '—'}
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                            {entry.action}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>{entry.entity}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{entry.entityId ?? '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{entry.actorUserId ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!auditLogs.length && !auditLoading ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    Sin registros. Configura filtros y consulta.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

        </div>
      </section>
    </main>
  );
}

