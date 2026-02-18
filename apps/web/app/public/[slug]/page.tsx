'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

type PublicPageProps = {
  params: {
    slug: string;
  };
};

type TenantProfile = {
  id: string;
  name: string;
  slug: string;
  plan: string;
};

type ServiceItem = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
};

type StaffItem = {
  id: string;
  fullName: string;
};

type FormField = {
  key?: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
};

type PublicSlotsResponse = {
  date: string;
  serviceId: string;
  staffId: string;
  slots: Array<{
    startAt: string;
    endAt: string;
  }>;
};

type BookingResponse = {
  id?: string;
  waitlisted?: boolean;
  waitlistEntry?: {
    id: string;
    status: string;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const today = new Date().toISOString().slice(0, 10);

const bookingSchema = z.object({
  apiBase: z.string().url(),
  slug: z.string().min(1),
  serviceId: z.string().min(1, 'Selecciona un servicio.'),
  staffId: z.string().min(1, 'Selecciona un profesional.'),
  startAt: z.string().min(1, 'Selecciona un horario.'),
  customerName: z.string().trim().min(1, 'Nombre requerido.'),
  customerEmail: z.string().trim().email('Email inválido.'),
  notes: z.string().optional()
});

const waitlistSchema = z.object({
  apiBase: z.string().url(),
  slug: z.string().min(1),
  serviceId: z.string().min(1, 'Selecciona un servicio.'),
  staffId: z.string().min(1, 'Selecciona un profesional.'),
  preferredStartAt: z.string().min(1, 'Ingresa fecha/hora preferida.'),
  customerName: z.string().trim().min(1, 'Nombre requerido.'),
  customerEmail: z.string().trim().email('Email inválido.'),
  notes: z.string().optional()
});

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function PublicBookingPage({ params }: PublicPageProps) {
  const [apiBase, setApiBase] = useState(API_BASE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(today);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [slots, setSlots] = useState<PublicSlotsResponse['slots']>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, string>>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistSuccess, setWaitlistSuccess] = useState('');
  const [preferredStartAt, setPreferredStartAt] = useState('');

  const normalizedFields = useMemo(
    () =>
      formFields
        .map((field, index) => {
          const key = (field.key ?? field.name ?? `field_${index}`).trim();
          if (!key) {
            return null;
          }

          return {
            key,
            label: field.label?.trim() || key,
            type: field.type?.trim().toLowerCase() || 'text',
            required: Boolean(field.required),
            placeholder: field.placeholder?.trim() || ''
          };
        })
        .filter((field): field is { key: string; label: string; type: string; required: boolean; placeholder: string } => !!field),
    [formFields]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError('');

      try {
        const [tenantResponse, servicesResponse, staffResponse, formResponse] = await Promise.all([
          fetch(new URL(`/public/${params.slug}`, apiBase).toString()),
          fetch(new URL(`/public/${params.slug}/services`, apiBase).toString()),
          fetch(new URL(`/public/${params.slug}/staff`, apiBase).toString()),
          fetch(new URL(`/public/${params.slug}/form`, apiBase).toString())
        ]);

        if (!tenantResponse.ok) {
          const text = await tenantResponse.text();
          throw new Error(text || `Error ${tenantResponse.status}`);
        }
        if (!servicesResponse.ok) {
          const text = await servicesResponse.text();
          throw new Error(text || `Error ${servicesResponse.status}`);
        }
        if (!staffResponse.ok) {
          const text = await staffResponse.text();
          throw new Error(text || `Error ${staffResponse.status}`);
        }
        if (!formResponse.ok) {
          const text = await formResponse.text();
          throw new Error(text || `Error ${formResponse.status}`);
        }

        const tenantPayload = (await tenantResponse.json()) as TenantProfile;
        const servicesPayload = (await servicesResponse.json()) as ServiceItem[];
        const staffPayload = (await staffResponse.json()) as StaffItem[];
        const formPayload = (await formResponse.json()) as { fields: FormField[] };

        if (cancelled) {
          return;
        }

        setTenant(tenantPayload);
        setServices(servicesPayload ?? []);
        setStaff(staffPayload ?? []);
        setFormFields(formPayload.fields ?? []);
        setServiceId((current) => current || servicesPayload[0]?.id || '');
        setStaffId((current) => current || staffPayload[0]?.id || '');
      } catch (bootstrapError) {
        if (cancelled) {
          return;
        }
        const message = bootstrapError instanceof Error ? bootstrapError.message : 'No se pudo cargar el perfil público';
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [apiBase, params.slug]);

  useEffect(() => {
    if (!serviceId || !staffId || !date) {
      setSlots([]);
      setSelectedSlot('');
      return;
    }

    let cancelled = false;

    async function loadSlots() {
      setSlotsLoading(true);
      setSlotsError('');

      try {
        const url = new URL(`/public/${params.slug}/slots`, apiBase);
        url.searchParams.set('serviceId', serviceId);
        url.searchParams.set('staffId', staffId);
        url.searchParams.set('date', date);

        const response = await fetch(url.toString());
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Error ${response.status}`);
        }

        const payload = (await response.json()) as PublicSlotsResponse;
        if (cancelled) {
          return;
        }

        setSlots(payload.slots ?? []);
        setSelectedSlot('');
      } catch (slotsLoadError) {
        if (cancelled) {
          return;
        }
        const message = slotsLoadError instanceof Error ? slotsLoadError.message : 'No se pudieron cargar horarios';
        setSlotsError(message);
        setSlots([]);
        setSelectedSlot('');
      } finally {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      }
    }

    void loadSlots();

    return () => {
      cancelled = true;
    };
  }, [apiBase, params.slug, serviceId, staffId, date]);

  useEffect(() => {
    if (selectedSlot) {
      setPreferredStartAt(toLocalDateTimeInput(selectedSlot));
    }
  }, [selectedSlot]);

  async function onSubmitBooking(event: FormEvent) {
    event.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');
    setWaitlistError('');
    setWaitlistSuccess('');

    const parsed = bookingSchema.safeParse({
      apiBase: apiBase.trim(),
      slug: params.slug,
      serviceId,
      staffId,
      startAt: selectedSlot,
      customerName,
      customerEmail,
      notes: notes.trim() || undefined
    });

    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? 'Datos inválidos para reservar.');
      return;
    }

    const requiredMissing = normalizedFields.find(
      (field) => field.required && !(customFieldsValues[field.key] ?? '').trim()
    );
    if (requiredMissing) {
      setSubmitError(`Completa el campo requerido: ${requiredMissing.label}.`);
      return;
    }

    const customFields = normalizedFields.reduce<Record<string, string>>((acc, field) => {
      const value = (customFieldsValues[field.key] ?? '').trim();
      if (value) {
        acc[field.key] = value;
      }
      return acc;
    }, {});

    setSubmitLoading(true);

    try {
      const response = await fetch(new URL(`/public/${parsed.data.slug}/bookings`, parsed.data.apiBase).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serviceId: parsed.data.serviceId,
          staffId: parsed.data.staffId,
          startAt: parsed.data.startAt,
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          notes: parsed.data.notes,
          customFields: Object.keys(customFields).length ? customFields : undefined
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as BookingResponse;
      if (payload.waitlisted) {
        setSubmitSuccess('Ese horario se ocupó recientemente. Te agregamos a lista de espera.');
      } else {
        setSubmitSuccess('Reserva confirmada. Revisa tu correo para la confirmación.');
      }

      setSelectedSlot('');
      setNotes('');
    } catch (submitRequestError) {
      const message = submitRequestError instanceof Error ? submitRequestError.message : 'No se pudo crear la reserva';
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  }

  async function onJoinWaitlist(event: FormEvent) {
    event.preventDefault();
    setWaitlistError('');
    setWaitlistSuccess('');
    setSubmitError('');

    const parsed = waitlistSchema.safeParse({
      apiBase: apiBase.trim(),
      slug: params.slug,
      serviceId,
      staffId,
      preferredStartAt,
      customerName,
      customerEmail,
      notes: notes.trim() || undefined
    });

    if (!parsed.success) {
      setWaitlistError(parsed.error.issues[0]?.message ?? 'Datos inválidos para lista de espera.');
      return;
    }

    const preferredDate = new Date(parsed.data.preferredStartAt);
    if (Number.isNaN(preferredDate.getTime())) {
      setWaitlistError('Fecha/hora preferida inválida.');
      return;
    }

    setWaitlistLoading(true);

    try {
      const response = await fetch(new URL(`/public/${parsed.data.slug}/waitlist`, parsed.data.apiBase).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serviceId: parsed.data.serviceId,
          staffId: parsed.data.staffId,
          preferredStartAt: preferredDate.toISOString(),
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          notes: parsed.data.notes
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setWaitlistSuccess('Te agregamos a lista de espera correctamente.');
    } catch (waitlistRequestError) {
      const message = waitlistRequestError instanceof Error ? waitlistRequestError.message : 'No se pudo registrar en lista de espera';
      setWaitlistError(message);
    } finally {
      setWaitlistLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 920, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>{tenant?.name ? `Reservas - ${tenant.name}` : 'Reservas online'}</h1>
      <p style={{ marginTop: 0, color: '#555' }}>Selecciona servicio, profesional y horario para agendar tu cita.</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
        style={{ marginBottom: 16, border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'grid', gap: 8 }}
      >
        <label>
          API URL
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} style={{ width: '100%' }} />
        </label>
      </form>

      {loading ? <div>Cargando perfil público...</div> : null}
      {error ? <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{error}</div> : null}

      {!loading && !error ? (
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <label>
              Servicio
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Seleccionar</option>
                {services.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.durationMinutes} min)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Profesional
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Seleccionar</option>
                {staff.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%' }} />
            </label>
          </div>

          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <strong>Horarios disponibles</strong>
            {slotsLoading ? <div style={{ marginTop: 8 }}>Cargando horarios...</div> : null}
            {slotsError ? <div style={{ marginTop: 8, color: '#900' }}>{slotsError}</div> : null}
            {!slotsLoading && !slotsError ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {slots.map((slot) => (
                  <button
                    key={slot.startAt}
                    type="button"
                    onClick={() => setSelectedSlot(slot.startAt)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: selectedSlot === slot.startAt ? '2px solid #1d4ed8' : '1px solid #ddd',
                      background: selectedSlot === slot.startAt ? '#eff6ff' : '#fff'
                    }}
                  >
                    {formatDateTime(slot.startAt)}
                  </button>
                ))}
                {!slots.length ? <span style={{ color: '#666' }}>Sin horarios para los filtros actuales.</span> : null}
              </div>
            ) : null}
          </div>

          <form onSubmit={onSubmitBooking} style={{ display: 'grid', gap: 10, border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <strong>Datos de la reserva</strong>
            <label>
              Nombre completo
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Email
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={{ width: '100%' }} />
            </label>

            {normalizedFields.map((field) => (
              <label key={field.key}>
                {field.label}
                {field.required ? ' *' : ''}
                {field.type === 'textarea' ? (
                  <textarea
                    value={customFieldsValues[field.key] ?? ''}
                    onChange={(e) =>
                      setCustomFieldsValues((current) => ({
                        ...current,
                        [field.key]: e.target.value
                      }))
                    }
                    placeholder={field.placeholder}
                    style={{ width: '100%', minHeight: 80 }}
                  />
                ) : (
                  <input
                    type={field.type === 'email' || field.type === 'tel' ? field.type : 'text'}
                    value={customFieldsValues[field.key] ?? ''}
                    onChange={(e) =>
                      setCustomFieldsValues((current) => ({
                        ...current,
                        [field.key]: e.target.value
                      }))
                    }
                    placeholder={field.placeholder}
                    style={{ width: '100%' }}
                  />
                )}
              </label>
            ))}

            <label>
              Notas (opcional)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', minHeight: 80 }} />
            </label>

            <div style={{ color: '#555' }}>
              Horario seleccionado:{' '}
              <strong>{selectedSlot ? formatDateTime(selectedSlot) : 'Ninguno'}</strong>
            </div>

            <button type="submit" disabled={submitLoading} style={{ width: 200, padding: '8px 12px' }}>
              {submitLoading ? 'Reservando...' : 'Confirmar reserva'}
            </button>

            {submitError ? <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{submitError}</div> : null}
            {submitSuccess ? <div style={{ background: '#ecfdf3', color: '#166534', padding: 10, borderRadius: 6 }}>{submitSuccess}</div> : null}
          </form>

          <form onSubmit={onJoinWaitlist} style={{ display: 'grid', gap: 10, border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <strong>Lista de espera</strong>
            <label>
              Fecha/hora preferida
              <input
                type="datetime-local"
                value={preferredStartAt}
                onChange={(e) => setPreferredStartAt(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>

            <button type="submit" disabled={waitlistLoading} style={{ width: 220, padding: '8px 12px' }}>
              {waitlistLoading ? 'Procesando...' : 'Unirme a lista de espera'}
            </button>

            {waitlistError ? <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{waitlistError}</div> : null}
            {waitlistSuccess ? <div style={{ background: '#ecfdf3', color: '#166534', padding: 10, borderRadius: 6 }}>{waitlistSuccess}</div> : null}
          </form>
        </section>
      ) : null}
    </main>
  );
}
