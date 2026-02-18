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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('es-MX');
}

export default function CustomerBookingsPage({ params }: PageProps) {
  const apiBase = API_BASE;
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [bookings, setBookings] = useState<BookingItem[]>([]);
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

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Email y contraseña son obligatorios.');
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
      setSuccess('Cuenta creada correctamente.');
      await loadBookings(payload.accessToken);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Email y contraseña son obligatorios.');
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
      setSuccess('Sesión iniciada correctamente.');
      await loadBookings(payload.accessToken);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar sesión');
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

  async function handleGoogleToken(idToken: string) {
    if (!idToken) {
      setError('Google no entregó token de sesión.');
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
      setSuccess('Sesión iniciada con Google.');
      await loadBookings(payload.accessToken);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar con Google');
    } finally {
      setGoogleLoading(false);
    }
  }

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
      await loadBookings(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar citas');
    } finally {
      setLoading(false);
    }
  }

  async function requestClaimCode() {
    if (!token) {
      setError('Primero inicia sesión para solicitar código de claim.');
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
      setClaimMessage(`Código enviado por email. Expira en ${payload.expiresInMinutes} min.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo solicitar código de claim');
    } finally {
      setClaimLoading(false);
    }
  }

  async function confirmClaimCode() {
    if (!token) {
      setError('Primero inicia sesión para confirmar claim.');
      return;
    }

    if (claimCode.trim().length !== 6) {
      setError('Ingresa un código de 6 dígitos.');
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
      setClaimMessage(`Claim confirmado. Citas vinculadas: ${payload.linkedBookings}.`);
      await refreshBookings();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo confirmar claim');
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
          <h1 className="page-title">Mis citas</h1>
          <p className="page-subtitle">Portal del cliente para consultar historial y próximas reservas.</p>
        </div>
      </header>

      <section style={{ display: 'grid', gap: 12, marginBottom: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="panel" style={{ display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>1) Acceso de cliente</h2>
          <p style={{ margin: 0, color: '#666' }}>
            Inicia sesión si ya tienes cuenta o crea una nueva para gestionar tus reservas.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={authMode === 'login' ? 'btn' : 'btn btn-ghost'}
              onClick={() => setAuthMode('login')}
              disabled={loading}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'btn' : 'btn btn-ghost'}
              onClick={() => setAuthMode('register')}
              disabled={loading}
            >
              Crear cuenta
            </button>
          </div>

          {authMode === 'register' ? (
            <label>
              Nombre
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} style={{ width: '100%' }} />
            </label>
          ) : null}

          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Contraseña
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
                {loading ? 'Procesando...' : 'Crear cuenta'}
              </button>
            ) : (
              <button onClick={handleLogin} type="button" className="btn" disabled={loading}>
                {loading ? 'Procesando...' : 'Iniciar sesión'}
              </button>
            )}

            <button onClick={refreshBookings} type="button" className="btn btn-ghost" disabled={!hasSession || loading}>
              Recargar citas
            </button>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {GOOGLE_CLIENT_ID ? (
              <>
                <div ref={googleButtonRef} />
                {!googleReady ? <small style={{ color: '#666' }}>Cargando botón de Google...</small> : null}
              </>
            ) : (
              <small style={{ color: '#666' }}>Google SSO no configurado en entorno (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`).</small>
            )}
            {googleLoading ? <small style={{ color: '#666' }}>Validando sesión de Google...</small> : null}
          </div>

          {error ? <div className="status-error">{error}</div> : null}
          {success ? <div className="status-success">{success}</div> : null}
        </section>

        <section className="panel" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>2) Vincular historial previo</h2>
          <p style={{ margin: 0, color: '#666' }}>
            Si ya reservabas antes sin cuenta, vincula ese historial con un código enviado por email.
          </p>

          {!hasSession ? (
            <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', color: '#666' }}>
              Primero inicia sesión o crea tu cuenta para habilitar esta sección.
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" onClick={requestClaimCode} disabled={!hasSession || claimLoading}>
              {claimLoading ? 'Procesando...' : 'Solicitar código'}
            </button>
          </div>

          <label>
            Código de 6 dígitos
            <input
              value={claimCode}
              onChange={(event) => setClaimCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ width: '100%' }}
              placeholder="123456"
            />
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={confirmClaimCode} disabled={!hasSession || claimLoading}>
              {claimLoading ? 'Procesando...' : 'Confirmar claim'}
            </button>
          </div>

          {claimMessage ? <div className="status-success">{claimMessage}</div> : null}
        </section>
      </section>

      <section className="panel" style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Citas registradas</h2>
        {!bookings.length ? <p style={{ margin: 0, color: '#666' }}>No hay citas para esta cuenta todavía.</p> : null}

        {bookings.map((booking) => (
          <article key={booking.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <strong style={{ display: 'block' }}>{booking.service?.name ?? 'Servicio'}</strong>
            <span style={{ display: 'block', color: '#555' }}>{formatDateTime(booking.startAt)}</span>
            <span style={{ display: 'block', color: '#555' }}>Profesional: {booking.staff?.fullName ?? 'N/A'}</span>
            <span style={{ display: 'block', color: '#555' }}>Estado: {booking.status}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
