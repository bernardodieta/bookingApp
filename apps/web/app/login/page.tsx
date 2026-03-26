'use client';

import Script from 'next/script';
<<<<<<< HEAD
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
=======
import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
>>>>>>> 1cf86de39bd6057ea631af9cf7c36bfaee28417c
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


type AuthResponse = {
  accessToken: string;
  user?: { role?: string; staffId?: string };
};

type AuthMode = 'login' | 'staff-register';

const MODE_LABELS: Record<AuthMode, string> = {
  login: 'Iniciar sesión',
  'staff-register': 'Registro staff',
};

const MODE_SUBTITLES: Record<AuthMode, string> = {
  login: 'Inicia sesión en tu panel de gestión.',
  'staff-register': 'Completá tu registro como miembro del equipo.',
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

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Support invitation links: ?mode=staff-register&tenant=my-slug
  const urlMode = searchParams.get('mode');
  const urlTenant = searchParams.get('tenant');
  const isInvitationFlow = urlMode === 'staff-register' && !!urlTenant;

  const [mode, setMode] = useState<AuthMode>(isInvitationFlow ? 'staff-register' : 'login');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [email, setEmail] = useState(isInvitationFlow ? '' : 'owner@demo.com');
  const [password, setPassword] = useState(isInvitationFlow ? '' : 'Password123');
  const [tenantSlug, setTenantSlug] = useState(urlTenant ?? '');
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
      setTenantSlug('');
    } else {
      setEmail('');
      setPassword('');
      setTenantSlug(urlTenant ?? '');
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
    color: active ? 'var(--brand-600)' : 'var(--neutral-400)',
    boxShadow: 'none',
  });

  const fieldErrorStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--error-400)',
    margin: '2px 0 0',
  };

  const buttonLabel = mode === 'login'
    ? (loading ? 'Ingresando...' : 'Entrar')
    : (loading ? 'Registrando...' : 'Crear cuenta staff');

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
          background: 'var(--bg)'
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
              borderRadius: 8,
              background: 'var(--primary, #2EBF8F)',
              color: '#fff',
              marginBottom: 14
            }}
          >
            <Building2 size={24} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--neutral-900)', letterSpacing: '-0.3px' }}>
            {MODE_LABELS[mode]}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--neutral-400)' }}>
            {MODE_SUBTITLES[mode]}
          </p>
        </div>

        {/* Card */}
        <div className="panel" style={{ width: '100%', maxWidth: 440, padding: '28px 28px 24px', display: 'grid', gap: 18 }}>

          {/* Mode tabs — only shown when arriving via staff invitation link */}
          {isInvitationFlow && (
            <div style={{ display: 'flex', gap: 4, background: 'var(--neutral-100)', borderRadius: 8, padding: 4 }}>
              {(['staff-register', 'login'] as AuthMode[]).map((m) => (
                <button key={m} type="button" style={tabStyle(mode === m)} onClick={() => switchMode(m)}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
            {mode === 'staff-register' && !urlTenant && (
              <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: 'var(--neutral-600)' }}>
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
              </label>
            )}

            <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: 'var(--neutral-600)' }}>
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

            <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: 'var(--neutral-600)' }}>
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
              <summary style={{ cursor: 'pointer', color: 'var(--neutral-400)', userSelect: 'none', listStyle: 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Avanzado</span>
              </summary>
              <label style={{ display: 'grid', gap: 5, marginTop: 10, fontWeight: 500, color: 'var(--neutral-600)' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--neutral-400)', fontSize: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border, #D8D5CF)' }} />
                o continúa con
                <div style={{ flex: 1, height: 1, background: 'var(--border, #D8D5CF)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {GOOGLE_CLIENT_ID ? (
                  <>
                    <div ref={setGoogleButtonNode} />
                    {googleScriptLoaded && !googleReady ? <small style={{ color: 'var(--neutral-400)' }}>Cargando botón de Google...</small> : null}
                    {googleLoading ? <small style={{ color: 'var(--neutral-400)' }}>Validando sesión de Google...</small> : null}
                  </>
                ) : (
                  <small style={{ color: 'var(--neutral-400)', textAlign: 'center' }}>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
