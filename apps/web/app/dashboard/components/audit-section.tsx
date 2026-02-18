import { Notice } from './notice';

type AuditSectionProps = {
  auditAction: string;
  setAuditAction: (value: string) => void;
  auditActorUserId: string;
  setAuditActorUserId: (value: string) => void;
  auditFrom: string;
  setAuditFrom: (value: string) => void;
  auditTo: string;
  setAuditTo: (value: string) => void;
  auditLimit: string;
  setAuditLimit: (value: string) => void;
  auditLoading: boolean;
  token: string;
  loadAuditLogs: (cursor?: string) => Promise<void>;
  auditCursor: string | null;
  auditError: string;
  setAuditError: (value: string) => void;
  auditLogs: Array<{
    id: string;
    createdAt: string;
    action: string;
    entity: string;
    entityId: string | null;
    actorUserId: string | null;
  }>;
};

export function AuditSection(props: AuditSectionProps) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ marginBottom: 8 }}>Auditoría (MVP)</h2>
      <p style={{ marginTop: 0, color: '#555' }}>Consulta acciones sensibles del tenant autenticado.</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.loadAuditLogs();
        }}
        style={{ display: 'grid', gap: 12, marginBottom: 14 }}
      >
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          <label>
            Acción (opcional)
            <input value={props.auditAction} onChange={(e) => props.setAuditAction(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Actor User ID (opcional)
            <input value={props.auditActorUserId} onChange={(e) => props.setAuditActorUserId(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Desde
            <input type="date" value={props.auditFrom} onChange={(e) => props.setAuditFrom(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Hasta
            <input type="date" value={props.auditTo} onChange={(e) => props.setAuditTo(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Límite
            <input type="number" min={1} max={200} value={props.auditLimit} onChange={(e) => props.setAuditLimit(e.target.value)} style={{ width: '100%' }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={props.auditLoading || !props.token.trim()} style={{ width: 180, padding: '8px 12px' }}>
            {props.auditLoading ? 'Cargando...' : 'Cargar auditoría'}
          </button>
          <button
            type="button"
            disabled={props.auditLoading || !props.auditCursor}
            onClick={() => {
              if (props.auditCursor) {
                void props.loadAuditLogs(props.auditCursor);
              }
            }}
            style={{ width: 180, padding: '8px 12px' }}
          >
            Siguiente página
          </button>
        </div>
      </form>

      <Notice tone="error" message={props.auditError} withMargin onClose={() => props.setAuditError('')} />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Fecha</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Acción</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Entidad</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Entity ID</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actor User ID</th>
            </tr>
          </thead>
          <tbody>
            {props.auditLogs.map((entry) => (
              <tr key={entry.id}>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{new Date(entry.createdAt).toLocaleString()}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{entry.action}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{entry.entity}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{entry.entityId ?? '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{entry.actorUserId ?? '-'}</td>
              </tr>
            ))}
            {!props.auditLogs.length ? (
              <tr>
                <td colSpan={5} style={{ padding: 10, color: '#666' }}>
                  Sin registros para los filtros actuales.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
