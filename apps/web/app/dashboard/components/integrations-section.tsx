import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StaffMember } from '../dashboard-types';
import { Notice } from './notice';

type IntegrationsSectionProps = {
  apiUrl: string;
  token: string;
  staffOptions: StaffMember[];
};

type CalendarAccountItem = {
  id: string;
  provider: 'google' | 'microsoft';
  staffId: string;
  calendarId: string;
  status: 'connected' | 'error' | 'disconnected';
  lastSyncAt: string | null;
  lastError: string | null;
  webhookExpiresAt?: string | null;
  tokenExpiresAt?: string | null;
};

type CalendarMetricsResponse = {
  generatedAt: string;
  windowDays: number;
  byProvider: Array<{
    provider: 'google' | 'microsoft';
    totalAccounts: number;
    connectedAccounts: number;
    erroredAccounts: number;
    staleAccounts: number;
    webhookExpiringSoon: number;
    tokenExpiringSoon: number;
  }>;
  queue: {
    pending: number;
    processing: number;
    succeeded: number;
    deadLetter: number;
  };
  incidents: {
    syncErrors: number;
    conflicts: number;
    deadLetters: number;
    retriesScheduled: number;
  };
  throughput: {
    outboundOk: number;
    inboundOk: number;
  };
  lag: {
    maxSyncLagMinutes: number | null;
    avgSyncLagMinutes: number | null;
    warningThresholdMinutes: number;
  };
};

type ConflictItem = {
  id: string;
  createdAt: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  resolved: boolean;
  resolution: {
    id: string;
    actorUserId: string | null;
    createdAt: string;
    metadata: Record<string, unknown> | null;
  } | null;
};

type ConflictsResponse = {
  items: ConflictItem[];
  nextCursor: string | null;
};

type ConflictPreviewResponse = {
  conflict: {
    id: string;
    reason: string;
    provider: 'google' | 'microsoft' | null;
    externalEventId: string | null;
  };
  resolved: boolean;
  suggestedAction: 'dismiss' | 'retry_sync';
  retrySync: {
    available: boolean;
    target: {
      accountId: string;
      provider: 'google' | 'microsoft';
      status: 'connected' | 'error' | 'disconnected';
      lastSyncAt: string | null;
      lastError: string | null;
    } | null;
  };
  impactSummary: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Error ${response.status}`);
  }

  return (await response.json()) as T;
}

export function IntegrationsSection({ apiUrl, token, staffOptions }: IntegrationsSectionProps) {
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [metricsWindowDays, setMetricsWindowDays] = useState('7');
  const [conflictStatusFilter, setConflictStatusFilter] = useState<'pending' | 'resolved' | 'all'>('pending');
  const [conflictProviderFilter, setConflictProviderFilter] = useState<'all' | 'google' | 'microsoft'>('all');
  const [conflictReasonFilter, setConflictReasonFilter] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [metrics, setMetrics] = useState<CalendarMetricsResponse | null>(null);
  const [accounts, setAccounts] = useState<CalendarAccountItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [conflictsCursor, setConflictsCursor] = useState<string | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState('');
  const [conflictNoteById, setConflictNoteById] = useState<Record<string, string>>({});
  const [conflictPreviewById, setConflictPreviewById] = useState<Record<string, ConflictPreviewResponse>>({});

  useEffect(() => {
    if (!selectedStaffId && staffOptions.length) {
      setSelectedStaffId(staffOptions[0]?.id ?? '');
    }
  }, [selectedStaffId, staffOptions]);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const staff of staffOptions) {
      map.set(staff.id, staff.fullName);
    }
    return map;
  }, [staffOptions]);

  const conflictStats = useMemo(() => {
    const pending = conflicts.filter((entry) => !entry.resolved).length;
    const resolved = conflicts.length - pending;

    return {
      total: conflicts.length,
      pending,
      resolved
    };
  }, [conflicts]);

  const filteredConflicts = useMemo(() => {
    const normalizedReasonFilter = conflictReasonFilter.trim().toLowerCase();

    return [...conflicts]
      .sort((a, b) => {
        if (a.resolved !== b.resolved) {
          return a.resolved ? 1 : -1;
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .filter((entry) => {
        if (conflictStatusFilter === 'pending' && entry.resolved) {
          return false;
        }

        if (conflictStatusFilter === 'resolved' && !entry.resolved) {
          return false;
        }

        const metadata = entry.metadata ?? {};
        const provider =
          typeof metadata.provider === 'string' && (metadata.provider === 'google' || metadata.provider === 'microsoft')
            ? metadata.provider
            : null;

        if (conflictProviderFilter !== 'all' && provider !== conflictProviderFilter) {
          return false;
        }

        if (!normalizedReasonFilter) {
          return true;
        }

        const reason = typeof metadata.reason === 'string' ? metadata.reason : '';
        return reason.toLowerCase().includes(normalizedReasonFilter);
      });
  }, [conflicts, conflictReasonFilter, conflictProviderFilter, conflictStatusFilter]);

  const loadData = useCallback(async () => {
    if (!token.trim()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const normalizedApiUrl = apiUrl.trim();
      const headers = {
        Authorization: `Bearer ${token}`
      };

      const safeWindow = Number.parseInt(metricsWindowDays, 10);
      const windowDays = Number.isFinite(safeWindow) ? Math.min(Math.max(safeWindow, 1), 30) : 7;

      const [metricsResponse, accountsResponse, conflictsResponse] = await Promise.all([
        fetch(new URL(`/integrations/calendar/metrics?windowDays=${windowDays}`, normalizedApiUrl).toString(), { headers }),
        fetch(new URL('/integrations/calendar/accounts', normalizedApiUrl).toString(), { headers }),
        fetch(new URL('/integrations/calendar/conflicts?limit=20', normalizedApiUrl).toString(), { headers })
      ]);

      const metricsPayload = await parseJsonResponse<CalendarMetricsResponse>(metricsResponse);
      const accountsPayload = await parseJsonResponse<CalendarAccountItem[]>(accountsResponse);
      const conflictsPayload = await parseJsonResponse<ConflictsResponse>(conflictsResponse);

      setMetrics(metricsPayload);
      setAccounts(accountsPayload);
      setConflicts(conflictsPayload.items ?? []);
      setConflictsCursor(conflictsPayload.nextCursor ?? null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo cargar integraciones';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, metricsWindowDays]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function openAuthorize(provider: 'google' | 'microsoft') {
    if (!token.trim() || !selectedStaffId) {
      setError('Selecciona staff para iniciar autorización OAuth.');
      return;
    }

    setActionLoadingId(`${provider}:authorize`);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(new URL(`/integrations/calendar/${provider}/authorize`, apiUrl.trim()).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          staffId: selectedStaffId
        })
      });

      const payload = await parseJsonResponse<{ authorizeUrl?: string }>(response);
      if (!payload.authorizeUrl) {
        throw new Error('No se recibió authorizeUrl.');
      }

      window.open(payload.authorizeUrl, '_blank', 'noopener,noreferrer');
      setSuccess(`Flujo OAuth ${provider} abierto en nueva pestaña.`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : `No se pudo autorizar ${provider}`;
      setError(message);
    } finally {
      setActionLoadingId('');
    }
  }

  async function resyncAccount(accountId: string) {
    if (!token.trim()) {
      return;
    }

    setActionLoadingId(`resync:${accountId}`);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(new URL(`/integrations/calendar/accounts/${accountId}/resync`, apiUrl.trim()).toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      await parseJsonResponse(response);
      setSuccess('Resync solicitado correctamente.');
      await loadData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo ejecutar resync';
      setError(message);
    } finally {
      setActionLoadingId('');
    }
  }

  async function disconnectAccount(accountId: string) {
    if (!token.trim()) {
      return;
    }

    setActionLoadingId(`disconnect:${accountId}`);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(new URL(`/integrations/calendar/accounts/${accountId}`, apiUrl.trim()).toString(), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      await parseJsonResponse(response);
      setSuccess('Cuenta desconectada correctamente.');
      await loadData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo desconectar cuenta';
      setError(message);
    } finally {
      setActionLoadingId('');
    }
  }

  async function loadMoreConflicts() {
    if (!token.trim() || !conflictsCursor) {
      return;
    }

    setActionLoadingId('conflicts:more');
    setError('');

    try {
      const response = await fetch(
        new URL(`/integrations/calendar/conflicts?limit=20&cursor=${encodeURIComponent(conflictsCursor)}`, apiUrl.trim()).toString(),
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const payload = await parseJsonResponse<ConflictsResponse>(response);
      setConflicts((current) => [...current, ...(payload.items ?? [])]);
      setConflictsCursor(payload.nextCursor ?? null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo cargar más conflictos';
      setError(message);
    } finally {
      setActionLoadingId('');
    }
  }

  async function resolveConflict(conflictId: string, action: 'dismiss' | 'retry_sync') {
    if (!token.trim()) {
      return;
    }

    setActionLoadingId(`resolve:${conflictId}:${action}`);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(new URL(`/integrations/calendar/conflicts/${conflictId}/resolve`, apiUrl.trim()).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          note: conflictNoteById[conflictId]?.trim() || undefined
        })
      });

      await parseJsonResponse(response);
      setSuccess(action === 'dismiss' ? 'Conflicto marcado como resuelto.' : 'Reintento de sync ejecutado y conflicto resuelto.');
      await loadData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo resolver conflicto';
      setError(message);
    } finally {
      setActionLoadingId('');
    }
  }

  async function previewConflict(conflictId: string) {
    if (!token.trim()) {
      return;
    }

    setActionLoadingId(`preview:${conflictId}`);
    setError('');

    try {
      const response = await fetch(new URL(`/integrations/calendar/conflicts/${conflictId}/preview`, apiUrl.trim()).toString(), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await parseJsonResponse<ConflictPreviewResponse>(response);
      setConflictPreviewById((current) => ({
        ...current,
        [conflictId]: payload
      }));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo cargar preview de conflicto';
      setError(message);
    } finally {
      setActionLoadingId('');
    }
  }

  return (
    <section className="section-block" style={{ marginTop: 28 }}>
      <h2 className="section-title">Integraciones Calendar</h2>
      <p className="section-subtitle">Conexiones, métricas operativas, conflictos y acciones de resolución.</p>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="section-grid section-grid-4" style={{ marginBottom: 10 }}>
          <label>
            Staff para conectar
            <select value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)} className="w-full">
              <option value="">Selecciona staff</option>
              {staffOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.fullName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ventana métricas (días)
            <input
              type="number"
              min={1}
              max={30}
              value={metricsWindowDays}
              onChange={(event) => setMetricsWindowDays(event.target.value)}
              className="w-full"
            />
          </label>
        </div>

        <div className="section-actions">
          <button
            type="button"
            className="btn btn-primary section-button-md"
            onClick={() => {
              void openAuthorize('google');
            }}
            disabled={!token.trim() || !selectedStaffId || actionLoadingId === 'google:authorize'}
          >
            {actionLoadingId === 'google:authorize' ? 'Abriendo...' : 'Conectar Google'}
          </button>
          <button
            type="button"
            className="btn btn-primary section-button-md"
            onClick={() => {
              void openAuthorize('microsoft');
            }}
            disabled={!token.trim() || !selectedStaffId || actionLoadingId === 'microsoft:authorize'}
          >
            {actionLoadingId === 'microsoft:authorize' ? 'Abriendo...' : 'Conectar Outlook'}
          </button>
          <button
            type="button"
            className="btn btn-ghost section-button-md"
            onClick={() => {
              void loadData();
            }}
            disabled={!token.trim() || loading}
          >
            {loading ? 'Actualizando...' : 'Actualizar sección'}
          </button>
        </div>
      </div>

      <Notice tone="error" message={error} withMargin onClose={() => setError('')} />
      <Notice tone="success" message={success} withMargin onClose={() => setSuccess('')} />

      <div className="panel" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Métricas</h3>
        {metrics ? (
          <div className="section-grid section-grid-4">
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Cola pending</div>
              <strong>{metrics.queue.pending}</strong>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Dead-letter</div>
              <strong>{metrics.queue.deadLetter}</strong>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Conflictos (ventana)</div>
              <strong>{metrics.incidents.conflicts}</strong>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Lag promedio (min)</div>
              <strong>{metrics.lag.avgSyncLagMinutes ?? '-'}</strong>
            </div>
            {metrics.byProvider.map((provider) => (
              <div key={provider.provider} style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{provider.provider.toUpperCase()}</div>
                <div>
                  {provider.connectedAccounts}/{provider.totalAccounts} conectadas · {provider.erroredAccounts} error · {provider.staleAccounts} stale
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#64748b' }}>Sin métricas por ahora.</div>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Cuentas conectadas</h3>
        <div className="table-wrap" style={{ padding: 0 }}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Staff</th>
                <th>Status</th>
                <th>Calendar</th>
                <th>Última sync</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.provider}</td>
                  <td>{staffNameById.get(account.staffId) ?? account.staffId}</td>
                  <td>{account.status}</td>
                  <td>{account.calendarId}</td>
                  <td>{account.lastSyncAt ? new Date(account.lastSyncAt).toLocaleString() : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          void resyncAccount(account.id);
                        }}
                        disabled={actionLoadingId === `resync:${account.id}`}
                      >
                        {actionLoadingId === `resync:${account.id}` ? 'Resync...' : 'Re-sync'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          void disconnectAccount(account.id);
                        }}
                        disabled={actionLoadingId === `disconnect:${account.id}`}
                      >
                        {actionLoadingId === `disconnect:${account.id}` ? 'Quitando...' : 'Desconectar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!accounts.length ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No hay cuentas conectadas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Conflictos inbound</h3>
        <div className="section-grid section-grid-4" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Total</div>
            <strong>{conflictStats.total}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Pendientes</div>
            <strong>{conflictStats.pending}</strong>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Resueltos</div>
            <strong>{conflictStats.resolved}</strong>
          </div>
        </div>

        <div className="section-grid section-grid-4" style={{ marginBottom: 12 }}>
          <label>
            Estado
            <select value={conflictStatusFilter} onChange={(event) => setConflictStatusFilter(event.target.value as 'pending' | 'resolved' | 'all')} className="w-full">
              <option value="pending">Pendientes</option>
              <option value="resolved">Resueltos</option>
              <option value="all">Todos</option>
            </select>
          </label>

          <label>
            Provider
            <select value={conflictProviderFilter} onChange={(event) => setConflictProviderFilter(event.target.value as 'all' | 'google' | 'microsoft')} className="w-full">
              <option value="all">Todos</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </select>
          </label>

          <label style={{ gridColumn: 'span 2' }}>
            Motivo contiene
            <input value={conflictReasonFilter} onChange={(event) => setConflictReasonFilter(event.target.value)} className="w-full" placeholder="Ej: external_event_without_link" />
          </label>
        </div>

        <div className="table-wrap" style={{ padding: 0 }}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Provider</th>
                <th>Motivo</th>
                <th>Entidad</th>
                <th>Estado</th>
                <th>Resolución</th>
                <th>Nota</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredConflicts.map((conflict) => {
                const reason =
                  conflict.metadata && typeof conflict.metadata.reason === 'string'
                    ? conflict.metadata.reason
                    : 'n/a';
                const provider =
                  conflict.metadata && typeof conflict.metadata.provider === 'string'
                    ? String(conflict.metadata.provider)
                    : '-';
                const resolutionAction =
                  conflict.resolution?.metadata && typeof conflict.resolution.metadata.resolutionAction === 'string'
                    ? conflict.resolution.metadata.resolutionAction
                    : null;
                const preview = conflictPreviewById[conflict.id];

                return (
                  <tr key={conflict.id}>
                    <td>{new Date(conflict.createdAt).toLocaleString()}</td>
                    <td>{provider}</td>
                    <td>{reason}</td>
                    <td>{conflict.entity}</td>
                    <td>{conflict.resolved ? 'Resuelto' : 'Pendiente'}</td>
                    <td>
                      {conflict.resolution
                        ? `${resolutionAction ?? 'resolved'} · ${new Date(conflict.resolution.createdAt).toLocaleString()}`
                        : '-'}
                    </td>
                    <td>
                      <input
                        value={conflictNoteById[conflict.id] ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setConflictNoteById((current) => ({
                            ...current,
                            [conflict.id]: value
                          }));
                        }}
                        className="w-full"
                        placeholder="Nota opcional"
                        disabled={conflict.resolved}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            void previewConflict(conflict.id);
                          }}
                          disabled={actionLoadingId === `preview:${conflict.id}`}
                        >
                          {actionLoadingId === `preview:${conflict.id}` ? 'Preview...' : 'Preview impacto'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            void resolveConflict(conflict.id, 'dismiss');
                          }}
                          disabled={conflict.resolved || actionLoadingId === `resolve:${conflict.id}:dismiss`}
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            void resolveConflict(conflict.id, 'retry_sync');
                          }}
                          disabled={conflict.resolved || actionLoadingId === `resolve:${conflict.id}:retry_sync`}
                        >
                          Retry sync
                        </button>
                      </div>

                      {preview ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#334155', maxWidth: 460 }}>
                          <div>
                            <strong>Sugerida:</strong> {preview.suggestedAction}
                            {preview.retrySync.target ? ` · cuenta ${preview.retrySync.target.status}` : ''}
                          </div>
                          <div>{preview.impactSummary}</div>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!filteredConflicts.length ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    Sin conflictos para los filtros actuales.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="section-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-ghost section-button-md"
            disabled={!conflictsCursor || actionLoadingId === 'conflicts:more'}
            onClick={() => {
              void loadMoreConflicts();
            }}
          >
            {actionLoadingId === 'conflicts:more' ? 'Cargando...' : 'Cargar más conflictos'}
          </button>
        </div>
      </div>
    </section>
  );
}
