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
    <section className="section-block" style={{ marginTop: 28 }}>
      <h2 className="section-title">Auditoría (MVP)</h2>
      <p className="section-subtitle">Consulta acciones sensibles del tenant autenticado.</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.loadAuditLogs();
        }}
        className="section-form"
        style={{ marginBottom: 14 }}
      >
        <div className="section-grid section-grid-5">
          <label>
            Acción (opcional)
            <input value={props.auditAction} onChange={(e) => props.setAuditAction(e.target.value)} className="w-full" />
          </label>
          <label>
            Actor User ID (opcional)
            <input value={props.auditActorUserId} onChange={(e) => props.setAuditActorUserId(e.target.value)} className="w-full" />
          </label>
          <label>
            Desde
            <input type="date" value={props.auditFrom} onChange={(e) => props.setAuditFrom(e.target.value)} className="w-full" />
          </label>
          <label>
            Hasta
            <input type="date" value={props.auditTo} onChange={(e) => props.setAuditTo(e.target.value)} className="w-full" />
          </label>
          <label>
            Límite
            <input type="number" min={1} max={200} value={props.auditLimit} onChange={(e) => props.setAuditLimit(e.target.value)} className="w-full" />
          </label>
        </div>
        <div className="section-actions">
          <button type="submit" disabled={props.auditLoading || !props.token.trim()} className="btn btn-primary section-button-md">
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
            className="btn btn-ghost section-button-md"
          >
            Siguiente página
          </button>
        </div>
      </form>

      <Notice tone="error" message={props.auditError} withMargin onClose={() => props.setAuditError('')} />

      <div className="table-wrap panel" style={{ padding: 0 }}>
        <table className="table-base">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Entity ID</th>
              <th>Actor User ID</th>
            </tr>
          </thead>
          <tbody>
            {props.auditLogs.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.createdAt).toLocaleString()}</td>
                <td>{entry.action}</td>
                <td>{entry.entity}</td>
                <td>{entry.entityId ?? '-'}</td>
                <td>{entry.actorUserId ?? '-'}</td>
              </tr>
            ))}
            {!props.auditLogs.length ? (
              <tr>
                <td colSpan={5} className="table-empty">
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
