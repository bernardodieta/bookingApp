'use client';

import Script from 'next/script';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Building2 } from 'lucide-react';

const TOKEN_KEY = 'apoint.dashboard.token';
const API_URL_KEY = 'apoint.dashboard.apiUrl';
const ROLE_KEY = 'apoint.dashboard.role';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

const loginSchema = z.object({
  email: z.string().trim().min(1, 'El email es obligatorio.').email('Email inválido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.').min(8, 'La contraseña debe tener al menos 8 caracteres.')
});

const staffRegisterSchema = z.object({
  tenantSlug: z.string().trim().min(1, 'El identificador del negocio es obligatorio.'),
  email: z.string().trim().min(1, 'El email es obligatorio.').email('Email inválido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.').min(8, 'La contraseña debe tener al menos 8 caracteres.')
});

const customerRegisterSchema = z.object({
  tenantSlug: z.string().trim().min(1, 'El identificador del negocio es obligatorio.'),
  fullName: z.string().trim().min(1, 'El nombre es obligatorio.'),
  email: z.string().trim().min(1, 'El email es obligatorio.').email('Email inválido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.').min(8, 'La contraseña debe tener al menos 8 caracteres.')
});

type AuthResponse = {
  accessToken: string;
  user?: { role?: string; staffId?: string };
};

type AuthMode = 'login' | 'staff-register' | 'customer-register';

const MODE_LABELS: Record<AuthMode, string> = {
  login: 'Iniciar sesión',
  'staff-register': 'Registro staff',
  'customer-register': 'Registro cliente',
};

const MODE_SUBTITLES: Record<AuthMode, string> = {
  login: 'Inicia sesión en tu panel de gestión.',
  'staff-register': 'Registrate como miembro del equipo de un negocio.',
  'customer-register': 'Crea tu cuenta de cliente para gestionar tus reservas.',
};

function redirectByRole(router: ReturnType<typeof useRouter>, role?: string) {
  if (role === 'staff') {
    router.replace('/staff-dashboard');
  } else {
    router.replace('/dashboard');
  }
}

/** Parse NestJS error responses into a user-friendly string */
function parseApiError(text: string, fallback: string): string {
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json.message)) {
      return json.message.join('. ');
    }
    if (typeof json.message === 'string') {
      return json.message;
    }
  } catch {
    // not JSON
  }
  return text || fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [email, setEmail] = useState('owner@demo.com');
  const [password, setPassword] = useState('Password123');
  const [tenantSlug, setTenantSlug] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleButtonNode, setGoogleButtonNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedApiUrl = localStorage.getItem(API_URL_KEY);
    const storedRole = localStorage.getItem(ROLE_KEY);
    if (storedApiUrl) {
      setApiUrl(storedApiUrl);
    }
    if (storedToken) {
      redirectByRole(router, storedRole ?? undefined);
    }
  }, [router]);

  function handleAuthSuccess(payload: AuthResponse, normalizedApiUrl: string) {
    const role = payload.user?.role ?? 'owner';
    localStorage.setItem(TOKEN_KEY, payload.accessToken);
    localStorage.setItem(API_URL_KEY, normalizedApiUrl);
    localStorage.setItem(ROLE_KEY, role);
    redirectByRole(router, role);
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError('');
    setSuccess('');
    setFieldErrors({});
    if (newMode === 'login') {
      setEmail('owner@demo.com');
      setPassword('Password123');
    } else {
      setEmail('');
      setPassword('');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});

    const normalizedApiUrl = apiUrl.trim();
    const apiUrlValid = z.string().url('API URL inválida.').safeParse(normalizedApiUrl);
    if (!apiUrlValid.success) {
      setError('API URL inválida.');
      return;
    }

    if (mode === 'login') {
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as string;
          if (!errs[key]) errs[key] = issue.message;
        }
        setFieldErrors(errs);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(new URL('/auth/login', normalizedApiUrl).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password })
        });
        if (!response.ok) {
          throw new Error(parseApiError(await response.text(), 'No se pudo iniciar sesión.'));
        }
        const payload = (await response.json()) as AuthResponse;
        if (!payload.accessToken) throw new Error('No se recibió accessToken.');
        handleAuthSuccess(payload, normalizedApiUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'staff-register') {
      const parsed = staffRegisterSchema.safeParse({ tenantSlug, email, password });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as string;
          if (!errs[key]) errs[key] = issue.message;
        }
        setFieldErrors(errs);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(new URL('/auth/staff/register', normalizedApiUrl).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantSlug: tenantSlug.trim(), email: email.trim(), password })
        });
        if (!response.ok) {
          throw new Error(parseApiError(await response.text(), 'No se pudo registrar como staff.'));
        }
        const payload = (await response.json()) as AuthResponse;
        if (!payload.accessToken) throw new Error('No se recibió accessToken.');
        handleAuthSuccess(payload, normalizedApiUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo registrar como staff.');
      } finally {
        setLoading(false);
      }
    } else {
      const parsed = customerRegisterSchema.safeParse({ tenantSlug, fullName, email, password });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as string;
          if (!errs[key]) errs[key] = issue.message;
        }
        setFieldErrors(errs);
        return;
      }

      setLoading(true);
      try {
        const slug = tenantSlug.trim();
        const response = await fetch(new URL(`/public/${encodeURIComponent(slug)}/customer-portal/unified-register`, normalizedApiUrl).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password })
        });
        if (!response.ok) {
          throw new Error(parseApiError(await response.text(), 'No se pudo crear la cuenta.'));
        }
        const payload = (await response.json()) as AuthResponse;
        if (!payload.accessToken) throw new Error('No se recibió accessToken.');

        // Customer portal token — redirect to their portal
        if (payload.user?.role === 'staff') {
          handleAuthSuccess(payload, normalizedApiUrl);
        } else {
          setSuccess('Cuenta creada correctamente. Ahora podés iniciar sesión desde la página del negocio.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleGoogleToken(idToken: string) {
    if (!idToken) {
      setError('Google no entregó token de sesión.');
      return;
    }

    const normalizedApiUrl = apiUrl.trim();
    const parsedApiUrl = z.string().url('API URL inválida.').safeParse(normalizedApiUrl);
    if (!parsedApiUrl.success) {
      setError(parsedApiUrl.error.issues[0]?.message ?? 'API URL inválida.');
      return;
    }

    setError('');
    setFieldErrors({});
    setGoogleLoading(true);

    try {
      const response = await fetch(new URL('/auth/google', normalizedApiUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      if (!response.ok) {
        throw new Error(parseApiError(await response.text(), 'No se pudo iniciar con Google.'));
      }

      const payload = (await response.json()) as AuthResponse;
      if (!payload.accessToken) throw new Error('No se recibió accessToken.');
      handleAuthSuccess(payload, normalizedApiUrl);
    } catch (googleError) {
      setError(googleError instanceof Error ? googleError.message : 'No se pudo iniciar con Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleScriptLoaded || !googleButtonNode) {
      return;
    }

    let cancelled = false;

    const renderButton = () => {
      const googleId = window.google?.accounts?.id;
      if (!googleId || !googleButtonNode || cancelled) {
        return false;
      }

      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          void handleGoogleToken(response.credential ?? '');
        }
      });

      googleButtonNode.innerHTML = '';
      googleId.renderButton(googleButtonNode, {
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
  }, [googleScriptLoaded, googleButtonNode]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 4px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    borderRadius: 8,
    transition: 'all 0.15s',
    background: active ? 'var(--surface, #fff)' : 'transparent',
    color: active ? 'var(--primary, #2563eb)' : '#64748b',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.09)' : 'none',
  });

  const fieldErrorStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#dc2626',
    margin: '2px 0 0',
  };

  const buttonLabel = mode === 'login'
    ? (loading ? 'Ingresando...' : 'Entrar')
    : mode === 'staff-register'
      ? (loading ? 'Registrando...' : 'Crear cuenta staff')
      : (loading ? 'Registrando...' : 'Crear cuenta');

  return (
    <>
      {GOOGLE_CLIENT_ID ? <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleScriptLoaded(true)} /> : null}

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          background: 'radial-gradient(circle at top, #eff6ff 0%, var(--bg, #f6f8fc) 40%, var(--bg, #f6f8fc) 100%)'
        }}
      >
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
              background: 'var(--primary, #2563eb)',
              color: '#fff',
              marginBottom: 14
            }}
          >
            <Building2 size={24} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>
            {MODE_LABELS[mode]}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>
            {MODE_SUBTITLES[mode]}
          </p>
        </div>

        {/* Card */}
        <div className="panel" style={{ width: '100%', maxWidth: 440, padding: '28px 28px 24px', display: 'grid', gap: 18 }}>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg, #f1f5f9)', borderRadius: 10, padding: 4 }}>
            {(['login', 'staff-register', 'customer-register'] as AuthMode[]).map((m) => (
              <button key={m} type="button" style={tabStyle(mode === m)} onClick={() => switchMode(m)}>
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
            {(mode === 'staff-register' || mode === 'customer-register') && (
              <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
                Identificador del negocio
                <input
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="Ej: barberia-don-juan"
                  style={{ width: '100%' }}
                  autoComplete="off"
                />
                {fieldErrors.tenantSlug && <span style={fieldErrorStyle}>{fieldErrors.tenantSlug}</span>}
                <small style={{ color: '#94a3b8', fontSize: 12 }}>
                  Pedile al negocio su identificador (slug).
                </small>
              </label>
            )}

            {mode === 'customer-register' && (
              <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
                Nombre completo
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  style={{ width: '100%' }}
                  autoComplete="name"
                />
                {fieldErrors.fullName && <span style={fieldErrorStyle}>{fieldErrors.fullName}</span>}
              </label>
            )}

            <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%' }}
                autoComplete="email"
              />
              {fieldErrors.email && <span style={fieldErrorStyle}>{fieldErrors.email}</span>}
            </label>

            <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%' }}
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {fieldErrors.password && <span style={fieldErrorStyle}>{fieldErrors.password}</span>}
            </label>

            <details style={{ fontSize: 13 }}>
              <summary style={{ cursor: 'pointer', color: '#94a3b8', userSelect: 'none', listStyle: 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Avanzado</span>
              </summary>
              <label style={{ display: 'grid', gap: 5, marginTop: 10, fontWeight: 500, color: '#374151' }}>
                API URL
                <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} style={{ width: '100%', fontSize: 12 }} />
              </label>
            </details>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 2, padding: '10px 0', fontSize: 15 }}
            >
              {buttonLabel}
            </button>
          </form>

          {mode === 'login' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border, #e2e8f0)' }} />
                o continúa con
                <div style={{ flex: 1, height: 1, background: 'var(--border, #e2e8f0)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {GOOGLE_CLIENT_ID ? (
                  <>
                    <div ref={setGoogleButtonNode} />
                    {googleScriptLoaded && !googleReady ? <small style={{ color: '#94a3b8' }}>Cargando botón de Google...</small> : null}
                    {googleLoading ? <small style={{ color: '#94a3b8' }}>Validando sesión de Google...</small> : null}
                  </>
                ) : (
                  <small style={{ color: '#94a3b8', textAlign: 'center' }}>
                    Configura NEXT_PUBLIC_GOOGLE_CLIENT_ID para habilitar Google SSO.
                  </small>
                )}
              </div>
            </>
          )}

          {success && <div className="status-ok" style={{ fontSize: 13, padding: '10px 12px' }}>{success}</div>}
          {error && <div className="status-error" style={{ fontSize: 13, padding: '10px 12px' }}>{error}</div>}
        </div>
      </div>
    </>
  );
}
