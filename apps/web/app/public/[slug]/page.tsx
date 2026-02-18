'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { CalendarDays, Clock3, Send, UserRound } from 'lucide-react';

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
  logoUrl: string | null;
  primaryColor: string | null;
  timeZone: string;
  locale: 'es' | 'en';
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

const COPY = {
  es: {
    titleFallback: 'Reservas online',
    subtitle: 'Selecciona servicio, profesional y horario para agendar tu cita.',
    loadingProfile: 'Cargando perfil público...',
    service: 'Servicio',
    professional: 'Profesional',
    date: 'Fecha',
    select: 'Seleccionar',
    availableSlots: 'Horarios disponibles',
    loadingSlots: 'Cargando horarios...',
    noSlots: 'Sin horarios para los filtros actuales.',
    bookingData: 'Datos de la reserva',
    fullName: 'Nombre completo',
    email: 'Email',
    notesOptional: 'Notas (opcional)',
    selectedSlot: 'Horario seleccionado',
    none: 'Ninguno',
    bookingSubmitting: 'Reservando...',
    bookingSubmit: 'Confirmar reserva',
    waitlist: 'Lista de espera',
    preferredDateTime: 'Fecha/hora preferida',
    waitlistSubmitting: 'Procesando...',
    waitlistSubmit: 'Unirme a lista de espera',
    requiredField: 'Completa el campo requerido',
    bookingCreated: 'Reserva confirmada. Revisa tu correo para la confirmación.',
    bookingWaitlisted: 'Ese horario se ocupó recientemente. Te agregamos a lista de espera.',
    bookingCreateError: 'No se pudo crear la reserva',
    waitlistCreated: 'Te agregamos a lista de espera correctamente.',
    waitlistCreateError: 'No se pudo registrar en lista de espera',
    invalidWaitlistDate: 'Fecha/hora preferida inválida.',
    invalidBookingData: 'Datos inválidos para reservar.',
    invalidWaitlistData: 'Datos inválidos para lista de espera.'
  },
  en: {
    titleFallback: 'Online booking',
    subtitle: 'Select service, professional and time slot to book your appointment.',
    loadingProfile: 'Loading public profile...',
    service: 'Service',
    professional: 'Professional',
    date: 'Date',
    select: 'Select',
    availableSlots: 'Available slots',
    loadingSlots: 'Loading slots...',
    noSlots: 'No slots available for current filters.',
    bookingData: 'Booking details',
    fullName: 'Full name',
    email: 'Email',
    notesOptional: 'Notes (optional)',
    selectedSlot: 'Selected slot',
    none: 'None',
    bookingSubmitting: 'Booking...',
    bookingSubmit: 'Confirm booking',
    waitlist: 'Waitlist',
    preferredDateTime: 'Preferred date/time',
    waitlistSubmitting: 'Processing...',
    waitlistSubmit: 'Join waitlist',
    requiredField: 'Please complete required field',
    bookingCreated: 'Booking confirmed. Check your email for confirmation.',
    bookingWaitlisted: 'That slot was just taken. We added you to the waitlist.',
    bookingCreateError: 'Could not create booking',
    waitlistCreated: 'You were added to the waitlist successfully.',
    waitlistCreateError: 'Could not join waitlist',
    invalidWaitlistDate: 'Invalid preferred date/time.',
    invalidBookingData: 'Invalid booking data.',
    invalidWaitlistData: 'Invalid waitlist data.'
  }
} as const;

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

function formatDateTime(value: string, timeZone?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('es-MX', timeZone ? { timeZone } : undefined);
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

  const locale = tenant?.locale === 'en' ? 'en' : 'es';
  const t = COPY[locale];

  const brandPrimary = useMemo(() => {
    const candidate = tenant?.primaryColor?.trim() ?? '';
    return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : '#1d4ed8';
  }, [tenant?.primaryColor]);

  const brandTint = `${brandPrimary}1A`;

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
      setSubmitError(parsed.error.issues[0]?.message ?? t.invalidBookingData);
      return;
    }

    const requiredMissing = normalizedFields.find(
      (field) => field.required && !(customFieldsValues[field.key] ?? '').trim()
    );
    if (requiredMissing) {
      setSubmitError(`${t.requiredField}: ${requiredMissing.label}.`);
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
        setSubmitSuccess(t.bookingWaitlisted);
      } else {
        setSubmitSuccess(t.bookingCreated);
      }

      setSelectedSlot('');
      setNotes('');
    } catch (submitRequestError) {
      const message = submitRequestError instanceof Error ? submitRequestError.message : t.bookingCreateError;
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
      setWaitlistError(parsed.error.issues[0]?.message ?? t.invalidWaitlistData);
      return;
    }

    const preferredDate = new Date(parsed.data.preferredStartAt);
    if (Number.isNaN(preferredDate.getTime())) {
      setWaitlistError(t.invalidWaitlistDate);
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

      setWaitlistSuccess(t.waitlistCreated);
    } catch (waitlistRequestError) {
      const message = waitlistRequestError instanceof Error ? waitlistRequestError.message : t.waitlistCreateError;
      setWaitlistError(message);
    } finally {
      setWaitlistLoading(false);
    }
  }

  return (
    <main className="app-shell" style={{ maxWidth: 980 }}>
      <header className="page-header">
        <div>
          <h1 className="page-title">{tenant?.name ? `Reservas · ${tenant.name}` : t.titleFallback}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="Logo" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', border: '1px solid var(--border)', background: '#fff' }} />
          ) : null}
          <div style={{ width: 46, height: 46, borderRadius: 12, background: brandTint, display: 'grid', placeItems: 'center' }}>
            <CalendarDays size={22} color={brandPrimary} />
          </div>
        </div>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
        className="panel"
        style={{ marginBottom: 16, display: 'grid', gap: 8 }}
      >
        <label>
          API URL
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} style={{ width: '100%' }} />
        </label>
      </form>

      {loading ? <div>{t.loadingProfile}</div> : null}
      {error ? <div className="status-error">{error}</div> : null}

      {!loading && !error ? (
        <section style={{ display: 'grid', gap: 12 }}>
          <div className="panel" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <label>
              {t.service}
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={{ width: '100%' }}>
                <option value="">{t.select}</option>
                {services.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.durationMinutes} min)
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.professional}
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ width: '100%' }}>
                <option value="">{t.select}</option>
                {staff.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.date}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%' }} />
            </label>
          </div>

          <div className="panel">
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Clock3 size={16} /> {t.availableSlots}
            </strong>
            {slotsLoading ? <div style={{ marginTop: 8 }}>{t.loadingSlots}</div> : null}
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
                      border: selectedSlot === slot.startAt ? `2px solid ${brandPrimary}` : '1px solid #ddd',
                      background: selectedSlot === slot.startAt ? brandTint : '#fff'
                    }}
                  >
                    {formatDateTime(slot.startAt, tenant?.timeZone)}
                  </button>
                ))}
                {!slots.length ? <span style={{ color: '#666' }}>{t.noSlots}</span> : null}
              </div>
            ) : null}
          </div>

          <form onSubmit={onSubmitBooking} className="panel" style={{ display: 'grid', gap: 10 }}>
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <UserRound size={16} /> {t.bookingData}
            </strong>
            <label>
              {t.fullName}
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              {t.email}
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
              {t.notesOptional}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', minHeight: 80 }} />
            </label>

            <div style={{ color: '#555' }}>
              {t.selectedSlot}:{' '}
              <strong>{selectedSlot ? formatDateTime(selectedSlot, tenant?.timeZone) : t.none}</strong>
            </div>

            <button
              type="submit"
              disabled={submitLoading}
              className="btn"
              style={{ width: 220, borderColor: brandPrimary, background: brandPrimary, color: '#fff' }}
            >
              <Send size={16} />
              {submitLoading ? t.bookingSubmitting : t.bookingSubmit}
            </button>

            {submitError ? <div className="status-error">{submitError}</div> : null}
            {submitSuccess ? <div className="status-success">{submitSuccess}</div> : null}
          </form>

          <form onSubmit={onJoinWaitlist} className="panel" style={{ display: 'grid', gap: 10 }}>
            <strong>{t.waitlist}</strong>
            <label>
              {t.preferredDateTime}
              <input
                type="datetime-local"
                value={preferredStartAt}
                onChange={(e) => setPreferredStartAt(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>

            <button type="submit" disabled={waitlistLoading} className="btn btn-ghost" style={{ width: 240 }}>
              {waitlistLoading ? t.waitlistSubmitting : t.waitlistSubmit}
            </button>

            {waitlistError ? <div className="status-error">{waitlistError}</div> : null}
            {waitlistSuccess ? <div className="status-success">{waitlistSuccess}</div> : null}
          </form>
        </section>
      ) : null}
    </main>
  );
}
