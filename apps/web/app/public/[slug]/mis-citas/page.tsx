'use client';

import Script from 'next/script';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

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
    fallbackService: 'Servicio'
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
    fallbackService: 'Service'
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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.googleError);
    } finally {
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadLocale() {
      try {
        const response = await fetch(new URL(`/public/${params.slug}`, apiBase).toString());
        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as TenantLocaleResponse;
        if (!cancelled) {
          setLocale(payload.locale === 'en' ? 'en' : 'es');
        }
      } catch {
        if (!cancelled) {
          setLocale('es');
        }
      }
    }

    void loadLocale();

    return () => {
      cancelled = true;
    };
  }, [apiBase, params.slug]);

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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.claimConfirmError);
    } finally {
      setClaimLoading(false);
    }
  }

  return (
    <main className="app-shell" style={{ maxWidth: 840 }}>
      {GOOGLE_CLIENT_ID ? (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      ) : null}

      <header className="page-header">
        <div>
          <h1 className="page-title">{copy.pageTitle}</h1>
          <p className="page-subtitle">{copy.pageSubtitle}</p>
        </div>
      </header>

      <section style={{ display: 'grid', gap: 12, marginBottom: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="panel" style={{ display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{copy.accessTitle}</h2>
          <p style={{ margin: 0, color: '#666' }}>{copy.accessSubtitle}</p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={authMode === 'login' ? 'btn' : 'btn btn-ghost'}
              onClick={() => setAuthMode('login')}
              disabled={loading}
            >
              {copy.loginMode}
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'btn' : 'btn btn-ghost'}
              onClick={() => setAuthMode('register')}
              disabled={loading}
            >
              {copy.registerMode}
            </button>
          </div>

          {authMode === 'register' ? (
            <label>
              {copy.fullName}
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} style={{ width: '100%' }} />
            </label>
          ) : null}

          <label>
            {copy.email}
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            {copy.password}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ width: '100%' }}
              minLength={8}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {authMode === 'register' ? (
              <button onClick={handleRegister} type="button" className="btn" disabled={loading}>
                {loading ? copy.processing : copy.registerMode}
              </button>
            ) : (
              <button onClick={handleLogin} type="button" className="btn" disabled={loading}>
                {loading ? copy.processing : copy.loginMode}
              </button>
            )}

            <button onClick={refreshBookings} type="button" className="btn btn-ghost" disabled={!hasSession || loading}>
              {copy.refresh}
            </button>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {GOOGLE_CLIENT_ID ? (
              <>
                <div ref={googleButtonRef} />
                {!googleReady ? <small style={{ color: '#666' }}>{copy.googleLoading}</small> : null}
              </>
            ) : (
              <small style={{ color: '#666' }}>{copy.googleUnavailable}</small>
            )}
            {googleLoading ? <small style={{ color: '#666' }}>{copy.googleValidating}</small> : null}
          </div>

          {error ? <div className="status-error">{error}</div> : null}
          {success ? <div className="status-success">{success}</div> : null}
        </section>

        <section className="panel" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{copy.claimTitle}</h2>
          <p style={{ margin: 0, color: '#666' }}>{copy.claimSubtitle}</p>

          {!hasSession ? (
            <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', color: '#666' }}>
              {copy.claimRequiresSession}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" onClick={requestClaimCode} disabled={!hasSession || claimLoading}>
              {claimLoading ? copy.processing : copy.requestCode}
            </button>
          </div>

          <label>
            {copy.claimCodeLabel}
            <input
              value={claimCode}
              onChange={(event) => setClaimCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ width: '100%' }}
              placeholder="123456"
            />
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={confirmClaimCode} disabled={!hasSession || claimLoading}>
              {claimLoading ? copy.processing : copy.confirmClaim}
            </button>
          </div>

          {claimMessage ? <div className="status-success">{claimMessage}</div> : null}
        </section>
      </section>

      <section className="panel" style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{locale === 'en' ? 'Your bookings' : 'Citas registradas'}</h2>
        {!bookings.length ? (
          <p style={{ margin: 0, color: '#666' }}>
            {locale === 'en' ? 'No bookings found for this account yet.' : 'No hay citas para esta cuenta todavía.'}
          </p>
        ) : null}

        {bookings.map((booking) => (
          <article key={booking.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'grid', gap: 6 }}>
            {(() => {
              const statusMeta = getBookingStatusMeta(booking.status, locale);
              return (
                <span
                  style={{
                    alignSelf: 'start',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '2px 10px',
                    ...statusMeta.style
                  }}
                >
                  {statusMeta.label}
                </span>
              );
            })()}
            <strong style={{ display: 'block' }}>{booking.service?.name ?? copy.fallbackService}</strong>
            <span style={{ display: 'block', color: '#555' }}>{formatDateTime(booking.startAt, locale)}</span>
            <span style={{ display: 'block', color: '#555' }}>
              {locale === 'en' ? 'Professional' : 'Profesional'}: {booking.staff?.fullName ?? 'N/A'}
            </span>
          </article>
        ))}
      </section>

      <section className="panel" style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{locale === 'en' ? 'Waitlist' : 'Lista de espera'}</h2>
        {!waitlistEntries.length ? (
          <p style={{ margin: 0, color: '#666' }}>
            {locale === 'en' ? 'You have no waitlist entries.' : 'No tienes entradas en lista de espera.'}
          </p>
        ) : null}

        {waitlistEntries.map((entry) => (
          <article key={entry.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'grid', gap: 6 }}>
            {(() => {
              const statusMeta = getWaitlistStatusMeta(entry.status, locale);
              return (
                <span
                  style={{
                    alignSelf: 'start',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '2px 10px',
                    ...statusMeta.style
                  }}
                >
                  {statusMeta.label}
                </span>
              );
            })()}
            <strong style={{ display: 'block' }}>{entry.service?.name ?? copy.fallbackService}</strong>
            <span style={{ display: 'block', color: '#555' }}>
              {locale === 'en' ? 'Professional' : 'Profesional'}: {entry.staff?.fullName ?? 'N/A'}
            </span>
            <span style={{ display: 'block', color: '#555' }}>
              {locale === 'en' ? 'Preference' : 'Preferencia'}: {formatDateTime(entry.preferredStartAt, locale)}
            </span>
            {typeof entry.queuePosition === 'number' && entry.queuePosition > 0 ? (
              <span style={{ display: 'block', color: '#555' }}>
                {locale === 'en' ? 'Queue position' : 'Posición en cola'}: #{entry.queuePosition}
              </span>
            ) : null}
            {entry.estimatedStartAt && entry.estimatedEndAt ? (
              <span style={{ display: 'block', color: '#555' }}>
                {locale === 'en' ? 'Estimated window' : 'Ventana estimada'}: {formatDateTime(entry.estimatedStartAt, locale)} -{' '}
                {formatDateTime(entry.estimatedEndAt, locale)}
              </span>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
