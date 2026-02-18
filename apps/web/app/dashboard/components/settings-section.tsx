import { useMemo, useState } from 'react';
import { Notice } from './notice';

type BookingFieldType = 'text' | 'email' | 'tel' | 'textarea';

type BookingFieldDraft = {
  key: string;
  label: string;
  type: BookingFieldType;
  required: boolean;
  placeholder: string;
};

type SettingsSectionProps = {
  settingsView: 'branding' | 'widget' | 'rules' | 'form';
  apiUrl: string;
  tenantSettings: { name: string; slug: string } | null;
  tenantSettingsLoading: boolean;
  token: string;
  loadTenantSettings: () => Promise<void>;
  tenantSettingsError: string;
  setTenantSettingsError: (value: string) => void;
  tenantSettingsSuccess: string;
  setTenantSettingsSuccess: (value: string) => void;
  onSaveBookingFormFields: (event: React.FormEvent) => Promise<void>;
  logoUrl: string;
  setLogoUrl: (value: string) => void;
  primaryColor: string;
  setPrimaryColor: (value: string) => void;
  customDomain: string;
  setCustomDomain: (value: string) => void;
  widgetEnabled: boolean;
  setWidgetEnabled: (value: boolean) => void;
  timeZone: string;
  setTimeZone: (value: string) => void;
  locale: 'es' | 'en';
  setLocale: (value: 'es' | 'en') => void;
  refundPolicy: 'full' | 'credit' | 'none';
  setRefundPolicy: (value: 'full' | 'credit' | 'none') => void;
  reminderHoursBeforeText: string;
  setReminderHoursBeforeText: (value: string) => void;
  bookingFormFieldsText: string;
  setBookingFormFieldsText: (value: string) => void;
};

const FIELD_TYPES: BookingFieldType[] = ['text', 'email', 'tel', 'textarea'];

function toSafeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40);
}

function parseBookingFields(text: string): { fields: BookingFieldDraft[]; error: string } {
  try {
    const parsed = JSON.parse(text || '[]') as unknown;
    if (!Array.isArray(parsed)) {
      return {
        fields: [],
        error: 'bookingFormFields debe ser un array de objetos.'
      };
    }

    const normalized = parsed
      .filter((entry) => typeof entry === 'object' && entry !== null)
      .map((entry) => {
        const record = entry as Record<string, unknown>;
        const key = toSafeKey(String(record.key ?? ''));
        const label = String(record.label ?? '').trim();
        const type = FIELD_TYPES.includes(String(record.type ?? 'text') as BookingFieldType)
          ? (String(record.type ?? 'text') as BookingFieldType)
          : 'text';

        return {
          key,
          label: label || key || 'Campo',
          type,
          required: Boolean(record.required),
          placeholder: String(record.placeholder ?? '').trim()
        } satisfies BookingFieldDraft;
      })
      .filter((field) => field.key.length > 0);

    return { fields: normalized, error: '' };
  } catch {
    return {
      fields: [],
      error: 'JSON inválido en bookingFormFields. Corrige o usa “modo avanzado”.'
    };
  }
}

function stringifyBookingFields(fields: BookingFieldDraft[]) {
  return JSON.stringify(
    fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder
    })),
    null,
    2
  );
}

export function SettingsSection(props: SettingsSectionProps) {
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  const parsedFieldsState = useMemo(() => parseBookingFields(props.bookingFormFieldsText), [props.bookingFormFieldsText]);
  const customFields = parsedFieldsState.fields;
  const showBrandingPanel = props.settingsView === 'branding';
  const showWidgetPanel = props.settingsView === 'widget';
  const showRulesPanel = props.settingsView === 'rules';
  const showFormPanel = props.settingsView === 'form';

  function updateFields(nextFields: BookingFieldDraft[]) {
    props.setBookingFormFieldsText(stringifyBookingFields(nextFields));
  }

  function addField(preset?: Partial<BookingFieldDraft>) {
    const baseLabel = (preset?.label ?? 'Campo adicional').trim();
    const baseKey = toSafeKey(preset?.key ?? (baseLabel || 'campo_adicional'));
    const existingKeys = new Set(customFields.map((field) => field.key));
    let nextKey = baseKey || 'campo_adicional';
    let suffix = 1;
    while (existingKeys.has(nextKey)) {
      suffix += 1;
      nextKey = `${baseKey || 'campo_adicional'}_${suffix}`;
    }

    updateFields([
      ...customFields,
      {
        key: nextKey,
        label: preset?.label?.trim() || 'Campo adicional',
        type: preset?.type && FIELD_TYPES.includes(preset.type) ? preset.type : 'text',
        required: Boolean(preset?.required),
        placeholder: preset?.placeholder?.trim() || ''
      }
    ]);
  }

  function addPreset(key: string, label: string, type: BookingFieldType, placeholder: string, required = false) {
    addField({ key, label, type, placeholder, required });
  }

  function updateField(index: number, patch: Partial<BookingFieldDraft>) {
    const nextFields = [...customFields];
    const current = nextFields[index];
    if (!current) {
      return;
    }

    nextFields[index] = {
      ...current,
      ...patch
    };

    updateFields(nextFields);
  }

  function removeField(index: number) {
    setConfirmDeleteIndex(null);
    updateFields(customFields.filter((_, fieldIndex) => fieldIndex !== index));
  }

  function moveField(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= customFields.length || toIndex >= customFields.length) {
      return;
    }

    const nextFields = [...customFields];
    const [moved] = nextFields.splice(fromIndex, 1);
    nextFields.splice(toIndex, 0, moved);
    setConfirmDeleteIndex(null);
    updateFields(nextFields);
  }

  const publicPath = props.tenantSettings?.slug ? `/public/${props.tenantSettings.slug}` : '';
  const publicUrl =
    props.tenantSettings?.slug && typeof window !== 'undefined'
      ? `${window.location.origin}${publicPath}`
      : publicPath;
  const normalizedCustomDomain = props.customDomain.trim().toLowerCase();
  const customDomainPublicUrl = normalizedCustomDomain
    ? `${normalizedCustomDomain.startsWith('localhost') ? 'http' : 'https'}://${normalizedCustomDomain}`
    : '';
  const widgetTargetUrl = customDomainPublicUrl || publicUrl;
  const widgetIframeSnippet = widgetTargetUrl
    ? `<iframe src="${widgetTargetUrl}" width="100%" height="780" style="border:0;border-radius:12px;overflow:hidden;" loading="lazy"></iframe>`
    : '';
  const widgetPopupSnippet = widgetTargetUrl
    ? `<a href="${widgetTargetUrl}" target="_blank" rel="noopener noreferrer">Reservar cita</a>`
    : '';
  const widgetPopupScriptSnippet = widgetTargetUrl
    ? `<button id="apoint-book-btn" type="button">Reservar cita</button>\n<script>\n(function(){\n  var btn=document.getElementById('apoint-book-btn');\n  if(!btn)return;\n  btn.addEventListener('click',function(){\n    var width=480,height=780,left=(window.screen.width-width)/2,top=(window.screen.height-height)/2;\n    window.open('${widgetTargetUrl}','apointBooking','width='+width+',height='+height+',left='+left+',top='+top+',menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');\n  });\n})();\n<\/script>`
    : '';
  const widgetSlugOrDomain = normalizedCustomDomain || props.tenantSettings?.slug || '';
  const widgetScriptSrc = widgetSlugOrDomain
    ? new URL(`/public/${widgetSlugOrDomain}/widget.js`, props.apiUrl.trim() || 'http://localhost:3001').toString()
    : '';
  const widgetScriptTagSnippet = widgetScriptSrc
    ? `<script src="${widgetScriptSrc}" defer></script>\n<button data-apoint-book type="button">Reservar cita</button>`
    : '';

  return (
    <section className="section-block" style={{ marginTop: 28 }}>
      <h2 className="section-title">Tenant Settings (MVP)</h2>
      <p className="section-subtitle">
        Configura el formulario público con una experiencia visual para {props.tenantSettings?.name ?? 'tu negocio'}.
      </p>

      <div className="section-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          disabled={props.tenantSettingsLoading || !props.token.trim()}
          onClick={() => {
            void props.loadTenantSettings();
          }}
          className="btn btn-ghost section-button-md"
        >
          {props.tenantSettingsLoading ? 'Cargando...' : 'Refresh settings'}
        </button>
      </div>

      {props.tenantSettings?.slug ? (
        <div className="panel" style={{ marginBottom: 12, background: 'var(--surface-muted)' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>URL pública para clientes</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' }}>{publicUrl}</div>
        </div>
      ) : null}

      <Notice tone="error" message={props.tenantSettingsError} withMargin onClose={() => props.setTenantSettingsError('')} />
      <Notice tone="success" message={props.tenantSettingsSuccess} withMargin onClose={() => props.setTenantSettingsSuccess('')} />

      <form onSubmit={props.onSaveBookingFormFields} className="section-form" style={{ gap: 12 }}>
        {showBrandingPanel ? (
        <div className="panel section-form" style={{ gap: 8 }}>
          <strong>Branding del negocio</strong>
          <p className="section-subtitle" style={{ fontSize: 13 }}>
            Personaliza el look público con logo y color principal.
          </p>

          <label>
            Logo URL
            <input
              type="url"
              value={props.logoUrl}
              onChange={(e) => props.setLogoUrl(e.target.value)}
              placeholder="https://mi-dominio.com/logo.png"
              className="w-full"
            />
          </label>

          <label>
            Color principal
            <div className="section-actions">
              <input
                type="color"
                value={props.primaryColor || '#2563eb'}
                onChange={(e) => props.setPrimaryColor(e.target.value)}
                style={{ width: 64, padding: 4 }}
              />
              <input
                value={props.primaryColor}
                onChange={(e) => props.setPrimaryColor(e.target.value)}
                placeholder="#2563eb"
                className="w-full"
              />
            </div>
          </label>

          <label>
            Dominio custom (opcional)
            <input
              value={props.customDomain}
              onChange={(e) => props.setCustomDomain(e.target.value)}
              placeholder="agenda.mi-negocio.com"
              className="w-full"
            />
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={props.widgetEnabled} onChange={(event) => props.setWidgetEnabled(event.target.checked)} />
            Habilitar widget embebible
          </label>

          <label>
            Zona horaria (IANA)
            <input
              value={props.timeZone}
              onChange={(e) => props.setTimeZone(e.target.value)}
              placeholder="Ej: America/Mexico_City"
              className="w-full"
            />
          </label>

          <label>
            Idioma
            <select value={props.locale} onChange={(e) => props.setLocale(e.target.value as 'es' | 'en')}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>

          <div className="section-actions">
            <button type="button" className="btn btn-ghost" onClick={() => props.setTimeZone('America/Mexico_City')}>
              MX
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => props.setTimeZone('America/Bogota')}>
              CO
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => props.setTimeZone('America/Lima')}>
              PE
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => props.setTimeZone('Europe/Madrid')}>
              ES
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => props.setTimeZone('UTC')}>
              UTC
            </button>
          </div>
        </div>
        ) : null}

        {showWidgetPanel ? (
        <div className="panel section-form" style={{ gap: 8 }}>
          <strong>Widget embebible</strong>
          <p className="section-subtitle" style={{ fontSize: 13 }}>
            Usa estos snippets para insertar reservas en tu web externa.
          </p>

          {widgetTargetUrl ? (
            <>
              <label>
                URL de booking usada por el widget
                <input value={widgetTargetUrl} readOnly className="w-full" />
              </label>

              <label>
                Snippet iframe
                <textarea readOnly value={widgetIframeSnippet} style={{ minHeight: 86, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
              </label>

              <label>
                Snippet enlace/popup
                <textarea readOnly value={widgetPopupSnippet} style={{ minHeight: 72, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
              </label>

              <label>
                Snippet JS popup
                <textarea readOnly value={widgetPopupScriptSnippet} style={{ minHeight: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
              </label>

              <label>
                Snippet script src (recomendado)
                <textarea readOnly value={widgetScriptTagSnippet} style={{ minHeight: 120, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
              </label>
            </>
          ) : (
            <div className="table-empty">Necesitas un slug o dominio custom para generar snippets.</div>
          )}

          {!props.widgetEnabled ? (
            <div style={{ color: '#555', fontSize: 13 }}>Activa “Habilitar widget embebible” y guarda para dejarlo disponible oficialmente.</div>
          ) : null}
        </div>
        ) : null}

        {showRulesPanel ? (
        <div className="panel section-form" style={{ gap: 8 }}>
          <strong>Reglas del negocio</strong>
          <p className="section-subtitle" style={{ fontSize: 13 }}>
            Ajusta devoluciones y envío de recordatorios antes de la cita.
          </p>

        <label>
          Política de cancelación
          <select value={props.refundPolicy} onChange={(e) => props.setRefundPolicy(e.target.value as 'full' | 'credit' | 'none')}>
            <option value="none">Sin devolución</option>
            <option value="credit">Crédito</option>
            <option value="full">Reembolso completo</option>
          </select>
        </label>
        <label>
          Horas de anticipación para recordatorios (0 desactiva)
          <input
            type="number"
            min={0}
            step={1}
            value={props.reminderHoursBeforeText}
            onChange={(e) => props.setReminderHoursBeforeText(e.target.value)}
          />
        </label>
        </div>
        ) : null}

        {showFormPanel ? (
        <>
        <div className="section-grid section-grid-2">
          <div className="panel section-form" style={{ gap: 10 }}>
            <div className="section-actions" style={{ justifyContent: 'space-between' }}>
              <strong>Campos personalizados</strong>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addField({ label: 'Nuevo campo', type: 'text', required: false })}
              >
                + Agregar campo
              </button>
            </div>

            <p className="section-subtitle" style={{ fontSize: 13 }}>
              Arrastra los campos para reordenarlos. El `key` técnico se gestiona automáticamente.
            </p>

            <div className="section-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => addPreset('phone', 'Teléfono', 'tel', 'Ej: +52 55 1234 5678')}
              >
                Preset: Teléfono
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => addPreset('document', 'DNI/Documento', 'text', 'Ej: 12345678')}
              >
                Preset: Documento
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => addPreset('notes', 'Notas adicionales', 'textarea', 'Indica detalles importantes')}
              >
                Preset: Notas
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => addPreset('birth_date', 'Fecha de nacimiento', 'text', 'Ej: 1990-04-22')}>
                Preset: Fecha nac.
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => addPreset('contact_channel', 'Canal preferido', 'text', 'WhatsApp / Email / Llamada')}>
                Preset: Canal contacto
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => addPreset('allergies', 'Alergias / condiciones', 'textarea', 'Ej: sensible a fragancias')}>
                Preset: Alergias
              </button>
            </div>

            {parsedFieldsState.error ? (
              <div className="status-error" style={{ fontSize: 13 }}>
                {parsedFieldsState.error}
              </div>
            ) : null}

            {customFields.length ? (
              <div className="settings-field-list">
                {customFields.map((field, index) => (
                  <article
                    key={`${field.key}-${index}`}
                    className={`settings-field-item ${dragIndex === index ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => {
                      setConfirmDeleteIndex(null);
                      setDragIndex(index);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) {
                        moveField(dragIndex, index);
                      }
                      setDragIndex(null);
                    }}
                  >
                    <div className="section-actions" style={{ justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 13 }}>Campo #{index + 1}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Arrastrar ↕</span>
                    </div>

                    <div className="settings-field-grid">
                      <label>
                        Label
                        <input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} className="w-full" />
                      </label>
                      <label>
                        Tipo
                        <select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as BookingFieldType })} className="w-full">
                          <option value="text">Texto</option>
                          <option value="email">Email</option>
                          <option value="tel">Teléfono</option>
                          <option value="textarea">Texto largo</option>
                        </select>
                      </label>
                      <label>
                        Placeholder
                        <input value={field.placeholder} onChange={(event) => updateField(index, { placeholder: event.target.value })} className="w-full" />
                      </label>
                    </div>

                    <div className="section-actions" style={{ justifyContent: 'space-between' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) => updateField(index, { required: event.target.checked })}
                        />
                        Campo obligatorio
                      </label>

                      <div className="section-actions" style={{ gap: 6 }}>
                        <button type="button" className="btn btn-ghost" onClick={() => moveField(index, Math.max(index - 1, 0))} disabled={index === 0}>
                          Subir
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => moveField(index, Math.min(index + 1, customFields.length - 1))}
                          disabled={index === customFields.length - 1}
                        >
                          Bajar
                        </button>
                        {confirmDeleteIndex === index ? (
                          <>
                            <button type="button" className="btn btn-primary" onClick={() => removeField(index)}>
                              Confirmar
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDeleteIndex(null)}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button type="button" className="btn btn-ghost" onClick={() => setConfirmDeleteIndex(index)}>
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="table-empty">No hay campos personalizados aún. Agrega uno para empezar.</div>
            )}
          </div>
        </div>

        <div className="panel section-form" style={{ gap: 8 }}>
          <div className="section-actions" style={{ justifyContent: 'space-between' }}>
            <strong>Modo avanzado (JSON)</strong>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdvancedJson((current) => !current)}>
              {showAdvancedJson ? 'Ocultar JSON' : 'Mostrar JSON'}
            </button>
          </div>

          {showAdvancedJson ? (
            <label>
              bookingFormFields
              <textarea
                value={props.bookingFormFieldsText}
                onChange={(e) => props.setBookingFormFieldsText(e.target.value)}
                style={{ minHeight: 180, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                placeholder='[{ "key": "phone", "label": "Teléfono", "type": "tel", "required": false }]'
              />
            </label>
          ) : (
            <div className="table-empty">Oculto para simplificar la edición. Actívalo solo si necesitas ajuste técnico manual.</div>
          )}

          <div style={{ color: '#555', fontSize: 13 }}>
            Campos soportados hoy por la UI pública: `text`, `email`, `tel`, `textarea`.
          </div>
        </div>
        </>
        ) : null}

        <button type="submit" disabled={props.tenantSettingsLoading || !props.token.trim()} className="btn btn-primary section-button-lg">
          {props.tenantSettingsLoading ? 'Guardando...' : 'Guardar configuración del formulario'}
        </button>
      </form>
    </section>
  );
}
