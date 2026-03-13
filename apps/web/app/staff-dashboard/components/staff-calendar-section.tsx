'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link as LinkIcon, Trash2, RefreshCw } from 'lucide-react';

type CalendarAccount = {
  id: string;
  provider: 'google' | 'microsoft';
  externalAccountId: string;
  calendarId: string;
  status: 'connected' | 'error' | 'disconnected';
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
};

type StaffCalendarSectionProps = {
  apiUrl: string;
  token: string;
};

const PROVIDER_LABELS: Record<string, { name: string; color: string; bg: string }> = {
  google:    { name: 'Google Calendar',    color: '#166534', bg: '#dcfce7' },
  microsoft: { name: 'Microsoft Outlook', color: '#1e3a5f', bg: '#dbeafe' }
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  connected:    { label: 'Conectado',    color: '#166534' },
  error:        { label: 'Error',        color: '#991b1b' },
  disconnected: { label: 'Desconectado', color: '#4b5563' }
};

export function StaffCalendarSection({ apiUrl, token }: StaffCalendarSectionProps) {
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectLoading, setConnectLoading] = useState<string | null>(null);
  const [disconnectLoading, setDisconnectLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!token.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(new URL('/integrations/calendar/accounts', apiUrl).toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      setAccounts(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar calendarios');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConnect(provider: 'google' | 'microsoft') {
    setConnectLoading(provider);
    setError('');
    try {
      const res = await fetch(
        new URL(`/integrations/calendar/${provider}/authorize`, apiUrl).toString(),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      const data = (await res.json()) as { authorizeUrl?: string };
      if (data.authorizeUrl) {
        window.open(data.authorizeUrl, '_blank', 'noopener');
        setSuccess(`Se abrió la ventana de autorización de ${PROVIDER_LABELS[provider].name}. Completa el proceso y luego actualiza esta página.`);
        setTimeout(() => setSuccess(''), 8000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar calendario');
    } finally {
      setConnectLoading(null);
    }
  }

  async function handleDisconnect(accountId: string) {
    setDisconnectLoading(accountId);
    setError('');
    try {
      const res = await fetch(
        new URL(`/integrations/calendar/accounts/${accountId}`, apiUrl).toString(),
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setSuccess('Calendario desconectado.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desconectar');
    } finally {
      setDisconnectLoading(null);
    }
  }

  return (
    <section>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Mi Calendario</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#64748b' }}>
        Vincula tu calendario para que las citas se sincronicen automáticamente.
      </p>

      {success && <div className="status-success" style={{ marginBottom: 12 }}>{success}</div>}
      {error && <div className="status-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Connect buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={connectLoading !== null}
          onClick={() => handleConnect('google')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <LinkIcon size={14} />
          {connectLoading === 'google' ? 'Conectando...' : 'Vincular Google Calendar'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={connectLoading !== null}
          onClick={() => handleConnect('microsoft')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#1e3a5f' }}
        >
          <LinkIcon size={14} />
          {connectLoading === 'microsoft' ? 'Conectando...' : 'Vincular Microsoft Calendar'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void load()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {loading && <p style={{ color: '#94a3b8', fontSize: 14 }}>Cargando calendarios...</p>}

      {/* Connected accounts */}
      {accounts.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {accounts.map((account) => {
            const providerMeta = PROVIDER_LABELS[account.provider] ?? { name: account.provider, color: '#555', bg: '#f5f5f5' };
            const statusInfo = STATUS_LABELS[account.status] ?? { label: account.status, color: '#555' };

            return (
              <div
                key={account.id}
                className="panel"
                style={{
                  padding: '14px 16px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: providerMeta.color,
                        background: providerMeta.bg,
                        padding: '2px 8px',
                        borderRadius: 99
                      }}
                    >
                      {providerMeta.name}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>{account.calendarId}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                    {account.lastSyncAt
                      ? `Última sync: ${new Date(account.lastSyncAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`
                      : 'Sin sincronización aún'}
                  </p>
                  {account.lastError && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#991b1b' }}>{account.lastError}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={disconnectLoading === account.id}
                  onClick={() => handleDisconnect(account.id)}
                  style={{ fontSize: 12, color: 'var(--danger, #b91c1c)', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Trash2 size={12} />
                  {disconnectLoading === account.id ? 'Quitando...' : 'Desconectar'}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="panel" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
            No tienes calendarios vinculados. Conecta uno para sincronizar tus citas automáticamente.
          </div>
        )
      )}
    </section>
  );
}
