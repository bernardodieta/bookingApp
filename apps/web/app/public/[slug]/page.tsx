'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { CalendarDays, Clock3, Menu, Send, UserRound, X } from 'lucide-react';

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
  queuePosition?: number;
  estimatedStartAt?: string;
  estimatedEndAt?: string;
  waitlistEntry?: {
    id: string;
    status: string;
  };
};

type WaitlistResponse = {
  queuePosition?: number;
  estimatedStartAt?: string;
  estimatedEndAt?: string;
  waitlistEntry?: {
    id: string;
    status: string;
  };
};

type PublicView = 'overview' | 'schedule' | 'booking' | 'waitlist' | 'portal';

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

function formatTime(value: string, timeZone?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {})
  });
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWaitlistFeedbackMessage(
  baseMessage: string,
  queuePosition?: number,
  estimatedStartAt?: string,
  estimatedEndAt?: string,
  timeZone?: string,
  locale: 'es' | 'en' = 'es'
) {
  const parts = [baseMessage];

  if (typeof queuePosition === 'number' && Number.isFinite(queuePosition) && queuePosition > 0) {
    parts.push(locale === 'en' ? `Queue position: #${queuePosition}.` : `Posición en cola: #${queuePosition}.`);
  }

  if (estimatedStartAt && estimatedEndAt) {
    const start = formatDateTime(estimatedStartAt, timeZone);
    const end = formatDateTime(estimatedEndAt, timeZone);
    parts.push(locale === 'en' ? `Estimated window: ${start} – ${end}.` : `Ventana estimada: ${start} – ${end}.`);
  }

  return parts.join(' ');
}

export default function PublicBookingPage({ params }: PublicPageProps) {
  const apiBase = API_BASE;
  const [activeView, setActiveView] = useState<PublicView>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const slotBuckets = useMemo(() => {
    const buckets = {
      morning: [] as PublicSlotsResponse['slots'],
      afternoon: [] as PublicSlotsResponse['slots'],
      evening: [] as PublicSlotsResponse['slots']
    };

    for (const slot of slots) {
      const hour = new Date(slot.startAt).getHours();
      if (Number.isNaN(hour)) {
        buckets.afternoon.push(slot);
        continue;
      }

      if (hour < 12) {
        buckets.morning.push(slot);
      } else if (hour < 18) {
        buckets.afternoon.push(slot);
      } else {
        buckets.evening.push(slot);
      }
    }

    return buckets;
  }, [slots]);

  const selectedService = useMemo(() => services.find((entry) => entry.id === serviceId) ?? null, [services, serviceId]);
  const selectedStaff = useMemo(() => staff.find((entry) => entry.id === staffId) ?? null, [staff, staffId]);

  const goToView = (view: PublicView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

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
        setSubmitSuccess(
          formatWaitlistFeedbackMessage(
            t.bookingWaitlisted,
            payload.queuePosition,
            payload.estimatedStartAt,
            payload.estimatedEndAt,
            tenant?.timeZone,
            locale
          )
        );
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

      const payload = (await response.json()) as WaitlistResponse;
      setWaitlistSuccess(
        formatWaitlistFeedbackMessage(
          t.waitlistCreated,
          payload.queuePosition,
          payload.estimatedStartAt,
          payload.estimatedEndAt,
          tenant?.timeZone,
          locale
        )
      );
    } catch (waitlistRequestError) {
      const message = waitlistRequestError instanceof Error ? waitlistRequestError.message : t.waitlistCreateError;
      setWaitlistError(message);
    } finally {
      setWaitlistLoading(false);
    }
  }

  return (
    <main className="dashboard-layout public-dashboard-shell">
      {mobileMenuOpen ? <button type="button" className="public-sidebar-overlay" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} /> : null}

      <aside className={`dashboard-sidebar surface ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo" style={{ background: brandTint, color: brandPrimary }}>
            <CalendarDays size={18} />
          </div>
          <div>
            <strong>{tenant?.name ?? t.titleFallback}</strong>
            <div style={{ fontSize: 12, color: '#64748b' }}>{locale === 'en' ? 'Customer booking panel' : 'Panel de reservas cliente'}</div>
          </div>
          <button type="button" className="public-mobile-menu-btn" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu">
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <button type="button" className={`sidebar-item ${activeView === 'overview' ? 'active' : ''}`} onClick={() => goToView('overview')}>
            <CalendarDays size={16} />
            {locale === 'en' ? 'Overview' : 'Resumen'}
          </button>
          <button type="button" className={`sidebar-item ${activeView === 'schedule' ? 'active' : ''}`} onClick={() => goToView('schedule')}>
            <Clock3 size={16} />
            {locale === 'en' ? 'Schedule' : 'Agenda'}
          </button>
          <button type="button" className={`sidebar-item ${activeView === 'booking' ? 'active' : ''}`} onClick={() => goToView('booking')}>
            <UserRound size={16} />
            {locale === 'en' ? 'Book' : 'Reservar'}
          </button>
          <button type="button" className={`sidebar-item ${activeView === 'waitlist' ? 'active' : ''}`} onClick={() => goToView('waitlist')}>
            <Send size={16} />
            {t.waitlist}
          </button>
          <button type="button" className={`sidebar-item ${activeView === 'portal' ? 'active' : ''}`} onClick={() => goToView('portal')}>
            <UserRound size={16} />
            {locale === 'en' ? 'My bookings portal' : 'Portal mis citas'}
          </button>
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar surface">
          <div className="topbar-left">
            <button type="button" className="public-mobile-menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation menu">
              <Menu size={16} />
              {locale === 'en' ? 'Menu' : 'Menu'}
            </button>
            <div className="topbar-logo" style={{ background: brandTint, color: brandPrimary }}>
              <CalendarDays size={18} />
            </div>
            <div>
              <strong>{tenant?.name ? `Reservas · ${tenant.name}` : t.titleFallback}</strong>
              <div style={{ fontSize: 12, color: '#64748b' }}>{t.subtitle}</div>
            </div>
          </div>
          {tenant?.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt="Logo"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                objectFit: 'contain',
                border: '1px solid var(--border)',
                background: '#fff'
              }}
            />
          ) : null}
        </header>

        {loading ? <div className="panel">{t.loadingProfile}</div> : null}
        {error ? <div className="status-error">{error}</div> : null}

        {!loading && !error ? (
          <>
            {activeView === 'overview' ? (
              <section style={{ display: 'grid', gap: 12 }}>
                <div className="panel" style={{ display: 'grid', gap: 8 }}>
                  <strong>{locale === 'en' ? 'Current setup' : 'Configuración actual'}</strong>
                  <div style={{ color: '#475569' }}>
                    {t.service}: <strong>{selectedService ? `${selectedService.name} (${selectedService.durationMinutes} min)` : t.none}</strong>
                  </div>
                  <div style={{ color: '#475569' }}>
                    {t.professional}: <strong>{selectedStaff?.fullName ?? t.none}</strong>
                  </div>
                  <div style={{ color: '#475569' }}>
                    {t.date}: <strong>{date}</strong>
                  </div>
                  <div style={{ color: '#475569' }}>
                    {t.selectedSlot}: <strong>{selectedSlot ? formatDateTime(selectedSlot, tenant?.timeZone) : t.none}</strong>
                  </div>
                </div>
                <div className="panel" style={{ display: 'grid', gap: 8 }}>
                  <strong>{locale === 'en' ? 'Recommended flow' : 'Flujo recomendado'}</strong>
                  <div style={{ color: '#475569' }}>1. {locale === 'en' ? 'Choose service, professional and date in Schedule.' : 'Elige servicio, profesional y fecha en Agenda.'}</div>
                  <div style={{ color: '#475569' }}>2. {locale === 'en' ? 'Pick a slot and continue to Book.' : 'Selecciona un horario y continúa a Reservar.'}</div>
                  <div style={{ color: '#475569' }}>3. {locale === 'en' ? 'If no slots are available, use Waitlist.' : 'Si no hay disponibilidad, usa Lista de espera.'}</div>
                </div>
              </section>
            ) : null}

            {activeView === 'schedule' ? (
              <section style={{ display: 'grid', gap: 12 }}>
                <div className="panel" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
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

                <div className="panel" style={{ display: 'grid', gap: 10 }}>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Clock3 size={16} /> {t.availableSlots}
                  </strong>
                  {slotsLoading ? <div>{t.loadingSlots}</div> : null}
                  {slotsError ? <div style={{ color: '#900' }}>{slotsError}</div> : null}

                  {!slotsLoading && !slotsError ? (
                    <div style={{ display: 'grid', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                      {([
                        ['morning', locale === 'en' ? 'Morning' : 'Mañana', slotBuckets.morning],
                        ['afternoon', locale === 'en' ? 'Afternoon' : 'Tarde', slotBuckets.afternoon],
                        ['evening', locale === 'en' ? 'Evening' : 'Noche', slotBuckets.evening]
                      ] as const).map(([key, label, bucketSlots]) => (
                        <div key={key} style={{ display: 'grid', gap: 6 }}>
                          <small style={{ color: '#666', fontWeight: 600 }}>{label}</small>
                          {bucketSlots.length ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {bucketSlots.map((slot) => (
                                <button
                                  key={slot.startAt}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSlot(slot.startAt);
                                    goToView('booking');
                                  }}
                                  style={{
                                    minWidth: 78,
                                    padding: '7px 10px',
                                    borderRadius: 8,
                                    border: selectedSlot === slot.startAt ? `2px solid ${brandPrimary}` : '1px solid var(--border)',
                                    background: selectedSlot === slot.startAt ? brandTint : 'var(--surface)',
                                    fontWeight: 600
                                  }}
                                  aria-pressed={selectedSlot === slot.startAt}
                                >
                                  {formatTime(slot.startAt, tenant?.timeZone)}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <small style={{ color: '#888' }}>{locale === 'en' ? 'No slots' : 'Sin horarios'}</small>
                          )}
                        </div>
                      ))}

                      {!slots.length ? <span style={{ color: '#666' }}>{t.noSlots}</span> : null}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {activeView === 'booking' ? (
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
            ) : null}

            {activeView === 'waitlist' ? (
              <form onSubmit={onJoinWaitlist} className="panel" style={{ display: 'grid', gap: 10 }}>
                <strong>{t.waitlist}</strong>
                <p style={{ margin: 0, color: '#64748b' }}>
                  {locale === 'en'
                    ? 'Use this option when no schedule works for you. We will notify you when a slot opens.'
                    : 'Usa esta opción cuando no te funcione el horario actual. Te avisaremos cuando se libere un cupo.'}
                </p>
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
            ) : null}

            {activeView === 'portal' ? (
              <section className="panel" style={{ display: 'grid', gap: 10 }}>
                <strong>{locale === 'en' ? 'My bookings portal' : 'Portal mis citas'}</strong>
                <p style={{ margin: 0, color: '#475569' }}>
                  {locale === 'en'
                    ? 'If you already booked before, sign in there to see history, waitlist status, and linked bookings.'
                    : 'Si ya reservaste antes, entra ahí para ver historial, estado de lista de espera y reservas vinculadas.'}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a className="btn" href={`/public/${params.slug}/mis-citas`}>
                    {locale === 'en' ? 'Go to my bookings' : 'Ir a mis citas'}
                  </a>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </section>

      <button type="button" className="btn public-mobile-cta" onClick={() => goToView('booking')}>
        <Send size={16} />
        {locale === 'en' ? 'Go to booking' : 'Ir a reservar'}
      </button>
    </main>
  );
}
