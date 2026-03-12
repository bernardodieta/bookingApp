'use client';

import Script from 'next/script';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { CalendarDays, Clock3, ClipboardList, Link2, ListChecks, LogOut, MoreHorizontal, Plus, RefreshCw, Send } from 'lucide-react';

type PageProps = {
  params: {
    slug: string;
  };
};

type CustomerPortalAuthResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
};

type BookingItem = {
  id: string;
  customerName: string;
  customerEmail: string;
  startAt: string;
  endAt: string;
  status: string;
  service?: {
    id: string;
    name: string;
    durationMinutes: number;
  };
  staff?: {
    id: string;
    fullName: string;
  };
};

type WaitlistItem = {
  id: string;
  status: 'waiting' | 'notified' | 'booked' | 'cancelled' | string;
  preferredStartAt: string;
  createdAt: string;
  notifiedAt?: string | null;
  queuePosition?: number | null;
  estimatedStartAt?: string;
  estimatedEndAt?: string;
  service?: {
    id: string;
    name: string;
    durationMinutes: number;
  };
  staff?: {
    id: string;
    fullName: string;
  };
};

type TenantLocaleResponse = {
  locale?: 'es' | 'en' | string;
};

type ServiceItem = { id: string; name: string; durationMinutes: number; price: number };
type StaffItem = { id: string; fullName: string };
type FormField = { key?: string; name?: string; label?: string; type?: string; required?: boolean; placeholder?: string };
type PublicSlotsResponse = { date: string; serviceId: string; staffId: string; slots: Array<{ startAt: string; endAt: string }> };
type BookingNewResponse = { id?: string; waitlisted?: boolean; queuePosition?: number; estimatedStartAt?: string; estimatedEndAt?: string };

type PortalView = 'bookings' | 'waitlist' | 'more' | 'booking';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const TODAY = new Date().toISOString().slice(0, 10);

const bookingFormSchema = z.object({
  serviceId: z.string().min(1, 'Selecciona un servicio.'),
  staffId: z.string().min(1, 'Selecciona un profesional.'),
  startAt: z.string().min(1, 'Selecciona un horario.'),
  customerName: z.string().trim().min(1, 'Nombre requerido.'),
  customerEmail: z.string().trim().email('Email inválido.'),
});

const waitlistFormSchema = z.object({
  serviceId: z.string().min(1, 'Selecciona un servicio.'),
  staffId: z.string().min(1, 'Selecciona un profesional.'),
  preferredStartAt: z.string().min(1, 'Ingresa fecha/hora preferida.'),
  customerName: z.string().trim().min(1, 'Nombre requerido.'),
  customerEmail: z.string().trim().email('Email inválido.'),
});

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

function formatDateTime(value: string, locale: 'es' | 'en' = 'es') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(locale === 'en' ? 'en-US' : 'es-MX');
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const PORTAL_COPY = {
  es: {
    pageTitle: 'Mis citas',
    pageSubtitle: 'Portal del cliente para consultar historial y próximas reservas.',
    accessTitle: '1) Acceso de cliente',
    accessSubtitle: 'Inicia sesión si ya tienes cuenta o crea una nueva para gestionar tus reservas.',
    loginMode: 'Iniciar sesión',
    registerMode: 'Crear cuenta',
    fullName: 'Nombre',
    email: 'Email',
    password: 'Contraseña',
    processing: 'Procesando...',
    refresh: 'Recargar citas',
    googleLoading: 'Cargando botón de Google...',
    googleUnavailable: 'Google SSO no configurado en entorno (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`).',
    googleValidating: 'Validando sesión de Google...',
    claimTitle: '2) Vincular historial previo',
    claimSubtitle: 'Si ya reservabas antes sin cuenta, vincula ese historial con un código enviado por email.',
    claimRequiresSession: 'Primero inicia sesión o crea tu cuenta para habilitar esta sección.',
    requestCode: 'Solicitar código',
    claimCodeLabel: 'Código de 6 dígitos',
    confirmClaim: 'Confirmar claim',
    requiredCredentials: 'Email y contraseña son obligatorios.',
    registerSuccess: 'Cuenta creada correctamente.',
    registerError: 'No se pudo crear la cuenta',
    loginSuccess: 'Sesión iniciada correctamente.',
    loginError: 'No se pudo iniciar sesión',
    googleNoToken: 'Google no entregó token de sesión.',
    googleSuccess: 'Sesión iniciada con Google.',
    googleError: 'No se pudo iniciar con Google',
    bookingsLoadError: 'No se pudieron cargar citas',
    claimRequestNeedsSession: 'Primero inicia sesión para solicitar código de claim.',
    claimRequestSuccess: (minutes: number) => `Código enviado por email. Expira en ${minutes} min.`,
    claimRequestError: 'No se pudo solicitar código de claim',
    claimConfirmNeedsSession: 'Primero inicia sesión para confirmar claim.',
    claimCodeInvalid: 'Ingresa un código de 6 dígitos.',
    claimConfirmSuccess: (count: number) => `Claim confirmado. Citas vinculadas: ${count}.`,
    claimConfirmError: 'No se pudo confirmar claim',
    fallbackService: 'Servicio',
    bookNow: 'Reservar nueva cita',
    bookNowHint: 'Aun no tienes citas en esta cuenta. Puedes agendar una nueva desde la pagina publica.',
    navAccess: 'Acceso',
    navClaim: 'Vincular historial',
    navBookings: 'Citas registradas',
    navWaitlist: 'Lista de espera',
    navLogout: 'Cerrar sesión',
    dashboardSubtitle: 'Gestiona tu cuenta, historial y estado de tus reservas.',
    sectionRequiresSession: 'Inicia sesión para ver esta sección.'
  },
  en: {
    pageTitle: 'My bookings',
    pageSubtitle: 'Customer portal to view history and upcoming bookings.',
    accessTitle: '1) Customer access',
    accessSubtitle: 'Sign in if you already have an account, or create one to manage your bookings.',
    loginMode: 'Sign in',
    registerMode: 'Create account',
    fullName: 'Name',
    email: 'Email',
    password: 'Password',
    processing: 'Processing...',
    refresh: 'Refresh bookings',
    googleLoading: 'Loading Google button...',
    googleUnavailable: 'Google SSO is not configured in environment (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`).',
    googleValidating: 'Validating Google session...',
    claimTitle: '2) Link previous history',
    claimSubtitle: 'If you booked before without an account, link that history using an email code.',
    claimRequiresSession: 'Please sign in or create an account to enable this section.',
    requestCode: 'Request code',
    claimCodeLabel: '6-digit code',
    confirmClaim: 'Confirm link',
    requiredCredentials: 'Email and password are required.',
    registerSuccess: 'Account created successfully.',
    registerError: 'Could not create account',
    loginSuccess: 'Signed in successfully.',
    loginError: 'Could not sign in',
    googleNoToken: 'Google did not return a session token.',
    googleSuccess: 'Signed in with Google.',
    googleError: 'Could not sign in with Google',
    bookingsLoadError: 'Could not load bookings',
    claimRequestNeedsSession: 'Sign in first to request a link code.',
    claimRequestSuccess: (minutes: number) => `Code sent by email. Expires in ${minutes} min.`,
    claimRequestError: 'Could not request link code',
    claimConfirmNeedsSession: 'Sign in first to confirm linking.',
    claimCodeInvalid: 'Enter a 6-digit code.',
    claimConfirmSuccess: (count: number) => `Link confirmed. Bookings linked: ${count}.`,
    claimConfirmError: 'Could not confirm link',
    fallbackService: 'Service',
    bookNow: 'Book new appointment',
    bookNowHint: 'No bookings on this account yet. You can schedule a new one from the public page.',
    navAccess: 'Access',
    navClaim: 'Link history',
    navBookings: 'Bookings',
    navWaitlist: 'Waitlist',
    navLogout: 'Sign out',
    dashboardSubtitle: 'Manage your account, booking history, and waitlist status.',
    sectionRequiresSession: 'Sign in to view this section.'
  }
} as const;

function getWaitlistStatusMeta(status: string, locale: 'es' | 'en') {
  switch (status) {
    case 'waiting':
      return {
        label: locale === 'en' ? 'Waiting' : 'En espera',
        style: {
          border: '1px solid #f59e0b',
          background: '#fef3c7',
          color: '#92400e'
        }
      };
    case 'notified':
      return {
        label: locale === 'en' ? 'Notified' : 'Notificado',
        style: {
          border: '1px solid #2563eb',
          background: '#dbeafe',
          color: '#1e3a8a'
        }
      };
    case 'booked':
      return {
        label: locale === 'en' ? 'Converted to booking' : 'Convertido en reserva',
        style: {
          border: '1px solid #16a34a',
          background: '#dcfce7',
          color: '#166534'
        }
      };
    case 'cancelled':
      return {
        label: locale === 'en' ? 'Cancelled' : 'Cancelado',
        style: {
          border: '1px solid #dc2626',
          background: '#fee2e2',
          color: '#991b1b'
        }
      };
    default:
      return {
        label: status,
        style: {
          border: '1px solid var(--border)',
          background: '#f8fafc',
          color: '#334155'
        }
      };
  }
}

function getBookingStatusMeta(status: string, locale: 'es' | 'en') {
  switch (status) {
    case 'confirmed':
      return {
        label: locale === 'en' ? 'Confirmed' : 'Confirmada',
        style: {
          border: '1px solid #16a34a',
          background: '#dcfce7',
          color: '#166534'
        }
      };
    case 'cancelled':
      return {
        label: locale === 'en' ? 'Cancelled' : 'Cancelada',
        style: {
          border: '1px solid #dc2626',
          background: '#fee2e2',
          color: '#991b1b'
        }
      };
    case 'rescheduled':
      return {
        label: locale === 'en' ? 'Rescheduled' : 'Reprogramada',
        style: {
          border: '1px solid #2563eb',
          background: '#dbeafe',
          color: '#1e3a8a'
        }
      };
    case 'completed':
      return {
        label: locale === 'en' ? 'Completed' : 'Completada',
        style: {
          border: '1px solid #0f766e',
          background: '#ccfbf1',
          color: '#115e59'
        }
      };
    case 'no_show':
      return {
        label: locale === 'en' ? 'No show' : 'No asistió',
        style: {
          border: '1px solid #f59e0b',
          background: '#fef3c7',
          color: '#92400e'
        }
      };
    default:
      return {
        label: status,
        style: {
          border: '1px solid var(--border)',
          background: '#f8fafc',
          color: '#334155'
        }
      };
  }
}

export default function CustomerBookingsPage({ params }: PageProps) {
  const apiBase = API_BASE;
  const [activeView, setActiveView] = useState<PortalView>('bookings');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [locale, setLocale] = useState<'es' | 'en'>('es');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const hasSession = useMemo(() => token.trim().length > 0, [token]);
  const copy = PORTAL_COPY[locale];

  // ── Booking flow state ────────────────────────────────────
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [bookingDate, setBookingDate] = useState(TODAY);
  const [slots, setSlots] = useState<Array<{ startAt: string; endAt: string }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingName, setBookingName] = useState('');
  const [bookingEmail, setBookingEmail] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, string>>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [preferredStartAt, setPreferredStartAt] = useState('');
  const [wlLoading, setWlLoading] = useState(false);
  const [wlError, setWlError] = useState('');
  const [wlSuccess, setWlSuccess] = useState('');

  // email from login pre-fills booking email
  const displayBookingEmail = bookingEmail || email;

  const normalizedFields = useMemo(
    () =>
      formFields
        .map((field, index) => {
          const key = (field.key ?? field.name ?? `field_${index}`).trim();
          if (!key) return null;
          return {
            key,
            label: field.label?.trim() || key,
            type: field.type?.trim().toLowerCase() || 'text',
            required: Boolean(field.required),
            placeholder: field.placeholder?.trim() || ''
          };
        })
        .filter((f): f is { key: string; label: string; type: string; required: boolean; placeholder: string } => !!f),
    [formFields]
  );

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError(copy.requiredCredentials);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(new URL(`/public/${params.slug}/customer-portal/register`, apiBase).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim() || undefined,
          email,
          password
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as CustomerPortalAuthResponse;
      setToken(payload.accessToken);
      setSuccess(copy.registerSuccess);
      await loadPortalData(payload.accessToken);
      setActiveView('bookings');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.registerError);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError(copy.requiredCredentials);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(new URL(`/public/${params.slug}/customer-portal/login`, apiBase).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as CustomerPortalAuthResponse;
      setToken(payload.accessToken);
      setSuccess(copy.loginSuccess);
      await loadPortalData(payload.accessToken);
      setActiveView('bookings');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.loginError);
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings(accessToken: string) {
    const response = await fetch(new URL(`/public/${params.slug}/customer-portal/bookings`, apiBase).toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Error ${response.status}`);
    }

    const payload = (await response.json()) as BookingItem[];
    setBookings(payload);
  }

  async function loadWaitlist(accessToken: string) {
    const response = await fetch(new URL(`/public/${params.slug}/customer-portal/waitlist`, apiBase).toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Error ${response.status}`);
    }

    const payload = (await response.json()) as WaitlistItem[];
    setWaitlistEntries(payload);
  }

  async function loadPortalData(accessToken: string) {
    await Promise.all([loadBookings(accessToken), loadWaitlist(accessToken)]);
  }

  async function handleGoogleToken(idToken: string) {
    if (!idToken) {
      setError(copy.googleNoToken);
      return;
    }

    setError('');
    setSuccess('');
    setGoogleLoading(true);

    try {
      const response = await fetch(new URL(`/public/${params.slug}/customer-portal/google`, apiBase).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as CustomerPortalAuthResponse;
      setToken(payload.accessToken);
      setSuccess(copy.googleSuccess);
      await loadPortalData(payload.accessToken);
      setActiveView('bookings');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.googleError);
    } finally {
      setGoogleLoading(false);
    }
  }

  // Bootstrap: locale + booking data (services/staff/form)
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [tenantRes, servicesRes, staffRes, formRes] = await Promise.all([
          fetch(new URL(`/public/${params.slug}`, apiBase).toString()),
          fetch(new URL(`/public/${params.slug}/services`, apiBase).toString()),
          fetch(new URL(`/public/${params.slug}/staff`, apiBase).toString()),
          fetch(new URL(`/public/${params.slug}/form`, apiBase).toString())
        ]);

        if (cancelled) return;

        if (tenantRes.ok) {
          const p = (await tenantRes.json()) as TenantLocaleResponse;
          if (!cancelled) setLocale(p.locale === 'en' ? 'en' : 'es');
        }
        if (servicesRes.ok) {
          const p = (await servicesRes.json()) as ServiceItem[];
          if (!cancelled) { setServices(p ?? []); setServiceId((c) => c || p[0]?.id || ''); }
        }
        if (staffRes.ok) {
          const p = (await staffRes.json()) as StaffItem[];
          if (!cancelled) { setStaff(p ?? []); setStaffId((c) => c || p[0]?.id || ''); }
        }
        if (formRes.ok) {
          const p = (await formRes.json()) as { fields: FormField[] };
          if (!cancelled) setFormFields(p.fields ?? []);
        }
      } catch {
        if (!cancelled) setLocale('es');
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [apiBase, params.slug]);

  // Load slots when booking filters change
  useEffect(() => {
    if (!serviceId || !staffId || !bookingDate) {
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
        url.searchParams.set('date', bookingDate);
        const res = await fetch(url.toString());
        if (!res.ok) { const t = await res.text(); throw new Error(t || `Error ${res.status}`); }
        const p = (await res.json()) as PublicSlotsResponse;
        if (!cancelled) { setSlots(p.slots ?? []); setSelectedSlot(''); }
      } catch (err) {
        if (!cancelled) { setSlotsError(err instanceof Error ? err.message : 'Error cargando horarios'); setSlots([]); }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }

    void loadSlots();
    return () => { cancelled = true; };
  }, [apiBase, params.slug, serviceId, staffId, bookingDate]);

  // Pre-fill waitlist datetime when a slot is selected
  useEffect(() => {
    if (selectedSlot) setPreferredStartAt(toLocalDateTimeInput(selectedSlot));
  }, [selectedSlot]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) {
      return;
    }

    let cancelled = false;

    const renderButton = () => {
      const googleId = window.google?.accounts?.id;
      if (!googleId || !googleButtonRef.current || cancelled) {
        return false;
      }

      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          void handleGoogleToken(response.credential ?? '');
        }
      });

      googleButtonRef.current.innerHTML = '';
      googleId.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 260
      });

      setGoogleReady(true);
      return true;
    };

    if (renderButton()) {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      if (renderButton()) {
        window.clearInterval(interval);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [apiBase, params.slug]);

  async function refreshBookings() {
    if (!token) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      await loadPortalData(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.bookingsLoadError);
    } finally {
      setLoading(false);
    }
  }

  async function requestClaimCode() {
    if (!token) {
      setError(copy.claimRequestNeedsSession);
      return;
    }

    setError('');
    setClaimMessage('');
    setClaimLoading(true);

    try {
      const response = await fetch(new URL(`/public/${params.slug}/customer-portal/claim/request`, apiBase).toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as { expiresInMinutes: number };
      setClaimMessage(copy.claimRequestSuccess(payload.expiresInMinutes));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.claimRequestError);
    } finally {
      setClaimLoading(false);
    }
  }

  async function confirmClaimCode() {
    if (!token) {
      setError(copy.claimConfirmNeedsSession);
      return;
    }

    if (claimCode.trim().length !== 6) {
      setError(copy.claimCodeInvalid);
      return;
    }

    setError('');
    setClaimMessage('');
    setClaimLoading(true);

    try {
      const response = await fetch(new URL(`/public/${params.slug}/customer-portal/claim/confirm`, apiBase).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: claimCode.trim()
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as { linkedBookings: number };
      setClaimMessage(copy.claimConfirmSuccess(payload.linkedBookings));
      await refreshBookings();
      setActiveView('bookings');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.claimConfirmError);
    } finally {
      setClaimLoading(false);
    }
  }

  function logoutSession() {
    setToken('');
    setBookings([]);
    setWaitlistEntries([]);
    setSuccess('');
    setError('');
    setClaimMessage('');
    setActiveView('bookings');
  }

  async function onSubmitBooking() {
    setSubmitError('');
    setSubmitSuccess('');
    setWlError('');
    setWlSuccess('');

    const parsed = bookingFormSchema.safeParse({
      serviceId,
      staffId,
      startAt: selectedSlot,
      customerName: bookingName,
      customerEmail: displayBookingEmail
    });
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
      return;
    }

    const requiredMissing = normalizedFields.find((f) => f.required && !(customFieldsValues[f.key] ?? '').trim());
    if (requiredMissing) {
      setSubmitError(`Campo requerido: ${requiredMissing.label}`);
      return;
    }

    const customFields = normalizedFields.reduce<Record<string, string>>((acc, f) => {
      const v = (customFieldsValues[f.key] ?? '').trim();
      if (v) acc[f.key] = v;
      return acc;
    }, {});

    setSubmitLoading(true);
    try {
      const response = await fetch(new URL(`/public/${params.slug}/bookings`, apiBase).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: parsed.data.serviceId,
          staffId: parsed.data.staffId,
          startAt: parsed.data.startAt,
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          notes: bookingNotes.trim() || undefined,
          customFields: Object.keys(customFields).length ? customFields : undefined
        })
      });
      if (!response.ok) { const text = await response.text(); throw new Error(text || `Error ${response.status}`); }
      const payload = (await response.json()) as BookingNewResponse;
      setSubmitSuccess(
        payload.waitlisted
          ? locale === 'en' ? 'That slot was just taken. Added to waitlist.' : 'Ese horario se ocupó. Te agregamos a lista de espera.'
          : locale === 'en' ? 'Booking confirmed! Check your email.' : '¡Reserva confirmada! Revisa tu correo.'
      );
      setSelectedSlot('');
      setBookingNotes('');
      if (token) void loadPortalData(token);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : locale === 'en' ? 'Could not create booking' : 'No se pudo crear la reserva');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function onJoinWaitlist() {
    setWlError('');
    setWlSuccess('');
    setSubmitError('');
    setSubmitSuccess('');

    const parsed = waitlistFormSchema.safeParse({
      serviceId,
      staffId,
      preferredStartAt,
      customerName: bookingName,
      customerEmail: displayBookingEmail
    });
    if (!parsed.success) {
      setWlError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
      return;
    }

    const preferredDate = new Date(parsed.data.preferredStartAt);
    if (Number.isNaN(preferredDate.getTime())) {
      setWlError(locale === 'en' ? 'Invalid preferred date/time.' : 'Fecha/hora preferida inválida.');
      return;
    }

    setWlLoading(true);
    try {
      const response = await fetch(new URL(`/public/${params.slug}/waitlist`, apiBase).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: parsed.data.serviceId,
          staffId: parsed.data.staffId,
          preferredStartAt: preferredDate.toISOString(),
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          notes: bookingNotes.trim() || undefined
        })
      });
      if (!response.ok) { const text = await response.text(); throw new Error(text || `Error ${response.status}`); }
      setWlSuccess(locale === 'en' ? 'Added to waitlist!' : '¡Agregado a lista de espera!');
      if (token) void loadPortalData(token);
    } catch (err) {
      setWlError(err instanceof Error ? err.message : locale === 'en' ? 'Could not join waitlist' : 'No se pudo unirse a lista de espera');
    } finally {
      setWlLoading(false);
    }
  }

  if (!hasSession) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          background: 'radial-gradient(circle at top, #eff6ff 0%, var(--bg) 40%, var(--bg) 100%)'
        }}
      >
        {GOOGLE_CLIENT_ID ? <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" /> : null}

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'var(--primary)',
              color: '#fff',
              marginBottom: 14
            }}
          >
            <ClipboardList size={24} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>{copy.pageTitle}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>{copy.pageSubtitle}</p>
        </div>

        {/* Card */}
        <div
          className="panel"
          style={{ width: '100%', maxWidth: 420, padding: '28px 28px 24px', display: 'grid', gap: 18 }}
        >
          {/* Mode toggle */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              borderRadius: 8,
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              padding: 3,
              gap: 2
            }}
          >
            {(['login', 'register'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAuthMode(mode)}
                disabled={loading}
                style={{
                  padding: '8px 0',
                  borderRadius: 6,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  background: authMode === mode ? 'var(--surface)' : 'transparent',
                  color: authMode === mode ? 'var(--primary)' : '#64748b',
                  boxShadow: authMode === mode ? '0 1px 3px rgba(0,0,0,0.09)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                {mode === 'login' ? copy.loginMode : copy.registerMode}
              </button>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={authMode === 'register' ? handleRegister : handleLogin}
            style={{ display: 'grid', gap: 14 }}
          >
            {authMode === 'register' ? (
              <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
                {copy.fullName}
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} style={{ width: '100%' }} />
              </label>
            ) : null}

            <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
              {copy.email}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={{ width: '100%' }}
                autoComplete="email"
              />
            </label>

            <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
              {copy.password}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ width: '100%' }}
                minLength={8}
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 2, padding: '10px 0', fontSize: 15 }}
            >
              {loading ? copy.processing : authMode === 'register' ? copy.registerMode : copy.loginMode}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            {locale === 'en' ? 'or continue with' : 'o continúa con'}
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Google SSO */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {GOOGLE_CLIENT_ID ? (
              <>
                <div ref={googleButtonRef} />
                {!googleReady && !googleLoading ? (
                  <small style={{ color: '#94a3b8' }}>{copy.googleLoading}</small>
                ) : null}
                {googleLoading ? <small style={{ color: '#94a3b8' }}>{copy.googleValidating}</small> : null}
              </>
            ) : (
              <small style={{ color: '#94a3b8', textAlign: 'center' }}>{copy.googleUnavailable}</small>
            )}
          </div>

          {/* Feedback */}
          {error ? <div className="status-error">{error}</div> : null}
          {success ? <div className="status-success">{success}</div> : null}
        </div>

        {/* Footer link */}
        <p style={{ margin: '20px 0 0', fontSize: 13, color: '#64748b', textAlign: 'center' }}>
          {locale === 'en' ? 'Looking to book an appointment? ' : '¿Quieres agendar una cita? '}
          <a
            href={`/public/${params.slug}`}
            style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
          >
            {copy.bookNow} →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', paddingBottom: 80 }}>

      {/* ── Compact sticky topbar ── */}
      <header
        className="surface"
        style={{
          borderBottom: '1px solid var(--border)',
          padding: '11px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 20
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            <ClipboardList size={16} />
          </div>
          <div>
            <strong style={{ fontSize: 15, display: 'block', lineHeight: 1.2 }}>{copy.pageTitle}</strong>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {locale === 'en' ? 'Your booking portal' : 'Tu portal de reservas'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={logoutSession}
          title={copy.navLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 10px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            cursor: 'pointer', color: '#64748b'
          }}
        >
          <LogOut size={15} />
        </button>
      </header>

      {/* ── Tab strip ── */}
      <nav
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          position: 'sticky',
          top: 57,
          zIndex: 19,
          padding: '0 4px'
        }}
      >
        {([
          { id: 'bookings' as PortalView, label: copy.navBookings, Icon: ClipboardList, count: bookings.length },
          { id: 'waitlist' as PortalView, label: copy.navWaitlist, Icon: ListChecks, count: waitlistEntries.length },
          { id: 'more' as PortalView, label: locale === 'en' ? 'More' : 'Más', Icon: MoreHorizontal, count: 0 }
        ]).map(({ id, label, Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveView(id)}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '12px 8px 10px',
              border: 'none',
              borderBottom: activeView === id ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent',
              color: activeView === id ? 'var(--primary)' : '#64748b',
              fontWeight: activeView === id ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            <Icon size={14} />
            {label}
            {count > 0 ? (
              <span
                style={{
                  fontSize: 11, fontWeight: 700, lineHeight: '18px',
                  background: activeView === id ? 'var(--primary)' : '#e2e8f0',
                  color: activeView === id ? '#fff' : '#475569',
                  borderRadius: 999, padding: '0 6px'
                }}
              >{count}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* ── Global feedback ── */}
      {(error || success) ? (
        <div style={{ maxWidth: 640, width: '100%', margin: '12px auto 0', padding: '0 16px', boxSizing: 'border-box' }}>
          {error ? <div className="status-error">{error}</div> : null}
          {success ? <div className="status-success">{success}</div> : null}
        </div>
      ) : null}

      {/* ── Page content ── */}
      <main style={{ flex: 1, padding: 16, maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Citas */}
        {activeView === 'bookings' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {locale === 'en' ? 'Your bookings' : 'Citas registradas'}
              </h2>
              <button
                type="button"
                onClick={refreshBookings}
                disabled={loading}
                title={copy.refresh}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 7,
                  border: '1px solid var(--border)', background: 'var(--surface-muted)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 12, color: '#64748b'
                }}
              >
                <RefreshCw size={13} style={{ opacity: loading ? 0.4 : 1 }} />
                {loading ? (locale === 'en' ? 'Loading…' : 'Cargando…') : copy.refresh}
              </button>
            </div>

            {!bookings.length ? (
              <div className="panel" style={{ textAlign: 'center', padding: 32, display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 36 }}>📅</div>
                <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>
                  {locale === 'en' ? 'No bookings yet' : 'Aún no tienes citas'}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{copy.bookNowHint}</p>
                <button type="button" className="btn btn-primary" onClick={() => setActiveView('booking')} style={{ justifyContent: 'center' }}>
                  {copy.bookNow}
                </button>
              </div>
            ) : bookings.map((booking) => {
              const statusMeta = getBookingStatusMeta(booking.status, locale);
              return (
                <article key={booking.id} className="panel" style={{ display: 'grid', gap: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 15 }}>{booking.service?.name ?? copy.fallbackService}</strong>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 10px', ...statusMeta.style }}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <span style={{ display: 'block', color: '#555', fontSize: 13 }}>🕐 {formatDateTime(booking.startAt, locale)}</span>
                  <span style={{ display: 'block', color: '#555', fontSize: 13 }}>👤 {booking.staff?.fullName ?? 'N/A'}</span>
                </article>
              );
            })}
          </div>
        ) : null}

        {/* Lista de espera */}
        {activeView === 'waitlist' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {locale === 'en' ? 'Waitlist' : 'Lista de espera'}
            </h2>
            {!waitlistEntries.length ? (
              <div className="panel" style={{ textAlign: 'center', padding: 32, display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 36 }}>⏳</div>
                <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>
                  {locale === 'en' ? 'No waitlist entries' : 'Sin entradas en lista de espera'}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  {locale === 'en'
                    ? "When your preferred slot opens up, we'll notify you."
                    : 'Cuando haya disponibilidad en tu horario preferido, te notificaremos.'}
                </p>
              </div>
            ) : waitlistEntries.map((entry) => {
              const statusMeta = getWaitlistStatusMeta(entry.status, locale);
              return (
                <article key={entry.id} className="panel" style={{ display: 'grid', gap: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 15 }}>{entry.service?.name ?? copy.fallbackService}</strong>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 10px', ...statusMeta.style }}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <span style={{ display: 'block', color: '#555', fontSize: 13 }}>👤 {entry.staff?.fullName ?? 'N/A'}</span>
                  <span style={{ display: 'block', color: '#555', fontSize: 13 }}>
                    📅 {locale === 'en' ? 'Preference' : 'Preferencia'}: {formatDateTime(entry.preferredStartAt, locale)}
                  </span>
                  {typeof entry.queuePosition === 'number' && entry.queuePosition > 0 ? (
                    <span style={{ display: 'block', fontSize: 13, color: '#555' }}>
                      🔢 {locale === 'en' ? 'Queue position' : 'Posición en cola'}: #{entry.queuePosition}
                    </span>
                  ) : null}
                  {entry.estimatedStartAt && entry.estimatedEndAt ? (
                    <span style={{ display: 'block', fontSize: 13, color: '#555' }}>
                      ⏰ {locale === 'en' ? 'Estimated window' : 'Ventana estimada'}:{' '}
                      {formatDateTime(entry.estimatedStartAt, locale)} – {formatDateTime(entry.estimatedEndAt, locale)}
                    </span>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {/* Más (vincular historial + cerrar sesión) */}
        {activeView === 'more' ? (
          <div style={{ display: 'grid', gap: 16 }}>

            {/* Vincular historial */}
            <section className="panel" style={{ display: 'grid', gap: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: '#eff6ff', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}
                >
                  <Link2 size={16} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: 14 }}>{copy.navClaim}</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{copy.claimSubtitle}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={requestClaimCode}
                disabled={claimLoading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {claimLoading ? copy.processing : copy.requestCode}
              </button>
              <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500 }}>
                {copy.claimCodeLabel}
                <input
                  value={claimCode}
                  onChange={(event) => setClaimCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ width: '100%' }}
                  placeholder="123456"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmClaimCode}
                disabled={claimLoading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {claimLoading ? copy.processing : copy.confirmClaim}
              </button>
              {claimMessage ? <div className="status-success">{claimMessage}</div> : null}
            </section>

            {/* Cerrar sesión */}
            <section
              className="panel"
              style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: 14 }}>{copy.navLogout}</strong>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {locale === 'en' ? 'Clear your current session.' : 'Cierra tu sesión actual.'}
                </span>
              </div>
              <button
                type="button"
                onClick={logoutSession}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid #fca5a5', background: '#fef2f2',
                  cursor: 'pointer', fontSize: 13, color: '#b91c1c', fontWeight: 600
                }}
              >
                <LogOut size={14} />
                {copy.navLogout}
              </button>
            </section>
          </div>
        ) : null}
      </main>

      {/* ── Full embedded booking view ── */}
      {activeView === 'booking' ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

          {/* Sub-header */}
          <div className="surface" style={{ borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => { setActiveView('bookings'); void refreshBookings(); setSubmitSuccess(''); setSubmitError(''); setWlSuccess(''); setWlError(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}
            >
              ← {locale === 'en' ? 'Back' : 'Volver'}
            </button>
            <strong style={{ flex: 1, fontSize: 15 }}>{copy.bookNow}</strong>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gap: 16, alignContent: 'start', maxWidth: 580, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

            {submitSuccess ? (
              /* Success state */
              <div className="panel" style={{ textAlign: 'center', padding: 36, display: 'grid', gap: 14 }}>
                <div style={{ fontSize: 52 }}>✅</div>
                <strong style={{ fontSize: 16 }}>{submitSuccess}</strong>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setSubmitSuccess(''); setSelectedSlot(''); }}
                  style={{ justifyContent: 'center' }}
                >
                  {locale === 'en' ? 'Book another' : 'Reservar otra cita'}
                </button>
              </div>
            ) : (
              <>
                {/* 1 — Filters */}
                <section className="panel" style={{ display: 'grid', gap: 12 }}>
                  <strong style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={16} />
                    {locale === 'en' ? '1. Choose service & date' : '1. Elige servicio y fecha'}
                  </strong>

                  <label style={{ display: 'grid', gap: 5, fontSize: 14 }}>
                    {locale === 'en' ? 'Service' : 'Servicio'}
                    <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSelectedSlot(''); }} style={{ width: '100%' }}>
                      <option value="">{locale === 'en' ? 'Select...' : 'Seleccionar...'}</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min)</option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: 5, fontSize: 14 }}>
                    {locale === 'en' ? 'Professional' : 'Profesional'}
                    <select value={staffId} onChange={(e) => { setStaffId(e.target.value); setSelectedSlot(''); }} style={{ width: '100%' }}>
                      <option value="">{locale === 'en' ? 'Select...' : 'Seleccionar...'}</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>{s.fullName}</option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: 5, fontSize: 14 }}>
                    {locale === 'en' ? 'Date' : 'Fecha'}
                    <input type="date" value={bookingDate} min={TODAY} onChange={(e) => { setBookingDate(e.target.value); setSelectedSlot(''); }} style={{ width: '100%' }} />
                  </label>
                </section>

                {/* 2 — Available slots */}
                <section className="panel" style={{ display: 'grid', gap: 10 }}>
                  <strong style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock3 size={16} />
                    {locale === 'en' ? '2. Pick a time slot' : '2. Selecciona un horario'}
                  </strong>
                  {slotsLoading ? <div style={{ color: '#64748b', fontSize: 13 }}>{locale === 'en' ? 'Loading...' : 'Cargando...'}</div> : null}
                  {slotsError ? <div className="status-error">{slotsError}</div> : null}
                  {!slotsLoading && !slotsError && !slots.length ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>
                      {locale === 'en' ? 'No slots available for current filters.' : 'Sin horarios disponibles para los filtros actuales.'}
                    </div>
                  ) : null}
                  {!slotsLoading && slots.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {slots.map((slot) => (
                        <button
                          key={slot.startAt}
                          type="button"
                          onClick={() => setSelectedSlot(slot.startAt)}
                          style={{
                            padding: '8px 14px', borderRadius: 8,
                            border: selectedSlot === slot.startAt ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: selectedSlot === slot.startAt ? '#eff6ff' : 'var(--surface)',
                            color: selectedSlot === slot.startAt ? 'var(--primary)' : '#374151',
                            fontWeight: selectedSlot === slot.startAt ? 700 : 400,
                            cursor: 'pointer', fontSize: 14
                          }}
                        >
                          {formatTime(slot.startAt)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>

                {/* 3 — Booking form */}
                <section className="panel" style={{ display: 'grid', gap: 12 }}>
                  <strong style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Send size={16} />
                    {locale === 'en' ? '3. Your details' : '3. Tus datos'}
                  </strong>

                  {selectedSlot ? (
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                      🕐 {locale === 'en' ? 'Selected:' : 'Seleccionado:'} {formatDateTime(selectedSlot, locale)}
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fafafa', border: '1px solid var(--border)', fontSize: 13, color: '#94a3b8' }}>
                      ↑ {locale === 'en' ? 'Select a time slot above first' : 'Primero selecciona un horario arriba'}
                    </div>
                  )}

                  <label style={{ display: 'grid', gap: 5, fontSize: 14 }}>
                    {locale === 'en' ? 'Full name' : 'Nombre completo'}
                    <input value={bookingName} onChange={(e) => setBookingName(e.target.value)} style={{ width: '100%' }} />
                  </label>

                  <label style={{ display: 'grid', gap: 5, fontSize: 14 }}>
                    Email
                    <input type="email" value={displayBookingEmail} onChange={(e) => setBookingEmail(e.target.value)} style={{ width: '100%' }} />
                  </label>

                  {normalizedFields.map((field) => (
                    <label key={field.key} style={{ display: 'grid', gap: 5, fontSize: 14 }}>
                      {field.label}{field.required ? ' *' : ''}
                      {field.type === 'textarea' ? (
                        <textarea
                          value={customFieldsValues[field.key] ?? ''}
                          onChange={(e) => setCustomFieldsValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          style={{ width: '100%', minHeight: 72 }}
                        />
                      ) : (
                        <input
                          type={field.type === 'email' || field.type === 'tel' ? field.type : 'text'}
                          value={customFieldsValues[field.key] ?? ''}
                          onChange={(e) => setCustomFieldsValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          style={{ width: '100%' }}
                        />
                      )}
                    </label>
                  ))}

                  <label style={{ display: 'grid', gap: 5, fontSize: 14 }}>
                    {locale === 'en' ? 'Notes (optional)' : 'Notas (opcional)'}
                    <textarea value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} style={{ width: '100%', minHeight: 72 }} />
                  </label>

                  <button
                    type="button"
                    onClick={() => void onSubmitBooking()}
                    disabled={submitLoading || !selectedSlot}
                    className="btn btn-primary"
                    style={{ justifyContent: 'center', width: '100%', padding: '11px 0', fontSize: 15, opacity: !selectedSlot || submitLoading ? 0.6 : 1 }}
                  >
                    {submitLoading
                      ? (locale === 'en' ? 'Booking...' : 'Reservando...')
                      : (locale === 'en' ? 'Confirm booking' : 'Confirmar reserva')}
                  </button>

                  {submitError ? <div className="status-error">{submitError}</div> : null}
                </section>

                {/* Waitlist option (collapsible) */}
                <details className="panel" style={{ padding: 16 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>⏳</span>
                    {locale === 'en' ? 'No suitable slot? Join the waitlist' : '¿Sin horario? Únete a la lista de espera'}
                  </summary>
                  <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                      {locale === 'en'
                        ? "We'll notify you when a slot opens that matches your preference."
                        : 'Te avisaremos cuando se libere un cupo que coincida con tu preferencia.'}
                    </p>
                    <label style={{ display: 'grid', gap: 5, fontSize: 14 }}>
                      {locale === 'en' ? 'Preferred date & time' : 'Fecha y hora preferida'}
                      <input type="datetime-local" value={preferredStartAt} onChange={(e) => setPreferredStartAt(e.target.value)} style={{ width: '100%' }} />
                    </label>
                    <button
                      type="button"
                      onClick={() => void onJoinWaitlist()}
                      disabled={wlLoading}
                      className="btn btn-ghost"
                      style={{ justifyContent: 'center', width: '100%' }}
                    >
                      {wlLoading
                        ? (locale === 'en' ? 'Processing...' : 'Procesando...')
                        : (locale === 'en' ? 'Join waitlist' : 'Unirme a lista de espera')}
                    </button>
                    {wlError ? <div className="status-error">{wlError}</div> : null}
                    {wlSuccess ? <div className="status-success">{wlSuccess}</div> : null}
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* ── FAB: Nueva cita (hidden on booking view) ── */}
      {activeView !== 'booking' ? (
        <button
          type="button"
          onClick={() => setActiveView('booking')}
          style={{
            position: 'fixed', bottom: 20, right: 16,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--primary)', color: '#fff',
            padding: '12px 20px', borderRadius: 99,
            fontWeight: 600, fontSize: 14,
            boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
            border: 'none', cursor: 'pointer', zIndex: 50
          }}
        >
          <Plus size={16} />
          {copy.bookNow}
        </button>
      ) : null}
    </div>
  );
}
