import { Notice } from './notice';

type SettingsSectionProps = {
  tenantSettings: { name: string; slug: string } | null;
  tenantSettingsLoading: boolean;
  token: string;
  loadTenantSettings: () => Promise<void>;
  tenantSettingsError: string;
  setTenantSettingsError: (value: string) => void;
  tenantSettingsSuccess: string;
  setTenantSettingsSuccess: (value: string) => void;
  onApplyBookingFieldPreset: (preset: Record<string, unknown>) => void;
  onSaveBookingFormFields: (event: React.FormEvent) => Promise<void>;
  refundPolicy: 'full' | 'credit' | 'none';
  setRefundPolicy: (value: 'full' | 'credit' | 'none') => void;
  reminderHoursBeforeText: string;
  setReminderHoursBeforeText: (value: string) => void;
  bookingFormFieldsText: string;
  setBookingFormFieldsText: (value: string) => void;
};

export function SettingsSection(props: SettingsSectionProps) {
  const publicPath = props.tenantSettings?.slug ? `/public/${props.tenantSettings.slug}` : '';
  const publicUrl =
    props.tenantSettings?.slug && typeof window !== 'undefined'
      ? `${window.location.origin}${publicPath}`
      : publicPath;

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ marginBottom: 8 }}>Tenant Settings (MVP)</h2>
      <p style={{ marginTop: 0, color: '#555' }}>
        Configura los campos del formulario público (`bookingFormFields`) para {props.tenantSettings?.name ?? 'tu negocio'}.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          disabled={props.tenantSettingsLoading || !props.token.trim()}
          onClick={() => {
            void props.loadTenantSettings();
          }}
          style={{ width: 200, padding: '8px 12px' }}
        >
          {props.tenantSettingsLoading ? 'Cargando...' : 'Refresh settings'}
        </button>
      </div>

      {props.tenantSettings?.slug ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 6, border: '1px solid #ddd', background: '#fafafa' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>URL pública para clientes</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' }}>{publicUrl}</div>
        </div>
      ) : null}

      <Notice tone="error" message={props.tenantSettingsError} withMargin onClose={() => props.setTenantSettingsError('')} />
      <Notice tone="success" message={props.tenantSettingsSuccess} withMargin onClose={() => props.setTenantSettingsSuccess('')} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() =>
            props.onApplyBookingFieldPreset({
              key: 'phone',
              label: 'Teléfono',
              type: 'tel',
              required: false,
              placeholder: 'Ej: +52 55 1234 5678'
            })
          }
          style={{ padding: '6px 10px' }}
        >
          Agregar Phone
        </button>
        <button
          type="button"
          onClick={() =>
            props.onApplyBookingFieldPreset({
              key: 'dni',
              label: 'DNI/Documento',
              type: 'text',
              required: false,
              placeholder: 'Ej: 12345678'
            })
          }
          style={{ padding: '6px 10px' }}
        >
          Agregar DNI
        </button>
        <button
          type="button"
          onClick={() =>
            props.onApplyBookingFieldPreset({
              key: 'notes',
              label: 'Notas adicionales',
              type: 'textarea',
              required: false,
              placeholder: 'Indica cualquier detalle importante para tu cita'
            })
          }
          style={{ padding: '6px 10px' }}
        >
          Agregar Notes
        </button>
      </div>

      <form onSubmit={props.onSaveBookingFormFields} style={{ display: 'grid', gap: 8, border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <label>
          refundPolicy
          <select value={props.refundPolicy} onChange={(e) => props.setRefundPolicy(e.target.value as 'full' | 'credit' | 'none')} style={{ width: 260 }}>
            <option value="none">Sin devolución</option>
            <option value="credit">Crédito</option>
            <option value="full">Reembolso completo</option>
          </select>
        </label>
        <label>
          reminderHoursBefore (0 desactiva recordatorios)
          <input
            type="number"
            min={0}
            step={1}
            value={props.reminderHoursBeforeText}
            onChange={(e) => props.setReminderHoursBeforeText(e.target.value)}
            style={{ width: 220 }}
          />
        </label>
        <label>
          bookingFormFields (JSON array)
          <textarea
            value={props.bookingFormFieldsText}
            onChange={(e) => props.setBookingFormFieldsText(e.target.value)}
            style={{ width: '100%', minHeight: 180, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            placeholder='[{ "key": "phone", "label": "Teléfono", "type": "tel", "required": false }]'
          />
        </label>
        <div style={{ color: '#555', fontSize: 13 }}>
          Sugerencia: usa objetos con `key`, `label`, `type` (`text|email|tel|textarea`) y `required`. El runner de
          recordatorios usa `reminderHoursBefore` para enviar emails antes de la cita. `refundPolicy` aplica al
          cancelar reservas con pagos (`none`, `credit`, `full`).
        </div>
        <button type="submit" disabled={props.tenantSettingsLoading || !props.token.trim()} style={{ width: 260, padding: '8px 12px' }}>
          {props.tenantSettingsLoading ? 'Guardando...' : 'Guardar bookingFormFields'}
        </button>
      </form>
    </section>
  );
}
