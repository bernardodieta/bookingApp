'use client';

import Script from 'next/script';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Building2 } from 'lucide-react';

const TOKEN_KEY = 'apoint.dashboard.token';
const API_URL_KEY = 'apoint.dashboard.apiUrl';
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

const loginSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  email: z.string().trim().email('Email inválido.'),
  password: z.string().min(8, 'Password debe tener al menos 8 caracteres.')
});

const registerSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  tenantName: z.string().trim().min(2, 'Nombre de negocio requerido.'),
  email: z.string().trim().email('Email inválido.'),
  password: z.string().min(8, 'Password debe tener al menos 8 caracteres.')
});

export default function LoginPage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState('http://localhost:3001');
  const [email, setEmail] = useState('owner@demo.com');
  const [password, setPassword] = useState('Password123');
  const [tenantName, setTenantName] = useState('Mi negocio');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleInitKey, setGoogleInitKey] = useState(0);
  const [googleButtonNode, setGoogleButtonNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedApiUrl = localStorage.getItem(API_URL_KEY);
    if (storedApiUrl) {
      setApiUrl(storedApiUrl);
    }
    if (storedToken) {
      router.replace('/dashboard');
    }
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const normalizedApiUrl = apiUrl.trim();
    const normalizedEmail = email.trim();
    const normalizedTenantName = tenantName.trim();

    let endpoint = '/auth/login';
    let requestBody: Record<string, string> = {
      email: normalizedEmail,
      password
    };

    if (mode === 'login') {
      const parsedLogin = loginSchema.safeParse({
        apiUrl: normalizedApiUrl,
        email: normalizedEmail,
        password
      });

      if (!parsedLogin.success) {
        setError(parsedLogin.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }
    } else {
      const parsedRegister = registerSchema.safeParse({
        apiUrl: normalizedApiUrl,
        tenantName: normalizedTenantName,
        email: normalizedEmail,
        password
      });

      if (!parsedRegister.success) {
        setError(parsedRegister.error.issues[0]?.message ?? 'Datos inválidos.');
        return;
      }

      endpoint = '/auth/register';
      requestBody = {
        tenantName: normalizedTenantName,
        email: normalizedEmail,
        password
      };
    }

    setLoading(true);

    try {
      const response = await fetch(new URL(endpoint, normalizedApiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as { accessToken: string };
      if (!payload.accessToken) {
        throw new Error('No se recibió accessToken.');
      }

      localStorage.setItem(TOKEN_KEY, payload.accessToken);
      localStorage.setItem(API_URL_KEY, normalizedApiUrl);
      router.replace('/dashboard');
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión';
      setError(message);
    } finally {
      setLoading(false);
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
    setGoogleLoading(true);

    try {
      const response = await fetch(new URL('/auth/google', normalizedApiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idToken })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as { accessToken: string };
      if (!payload.accessToken) {
        throw new Error('No se recibió accessToken.');
      }

      localStorage.setItem(TOKEN_KEY, payload.accessToken);
      localStorage.setItem(API_URL_KEY, normalizedApiUrl);
      router.replace('/dashboard');
    } catch (googleError) {
      setError(googleError instanceof Error ? googleError.message : 'No se pudo iniciar con Google');
    } finally {
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleScriptLoaded || mode !== 'login' || !googleButtonNode) {
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
  }, [googleScriptLoaded, googleButtonNode, mode, googleInitKey]);

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
            {mode === 'login' ? 'Acceso de socio' : 'Crear negocio'}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>
            {mode === 'login' ? 'Inicia sesión en tu panel de gestión.' : 'Registra tu negocio y entra en un paso.'}
          </p>
        </div>

        {/* Card */}
        <div className="panel" style={{ width: '100%', maxWidth: 440, padding: '28px 28px 24px', display: 'grid', gap: 18 }}>

          {/* Mode toggle */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              borderRadius: 8,
              background: 'var(--surface-muted, #f1f5f9)',
              border: '1px solid var(--border, #e2e8f0)',
              padding: 3,
              gap: 2
            }}
          >
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError('');
                  setGoogleReady(false);
                  if (m === 'login') setGoogleInitKey((v) => v + 1);
                }}
                disabled={loading}
                style={{
                  padding: '8px 0',
                  borderRadius: 6,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  background: mode === m ? 'var(--surface, #fff)' : 'transparent',
                  color: mode === m ? 'var(--primary, #2563eb)' : '#64748b',
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.09)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                {m === 'login' ? 'Ya tengo cuenta' : 'Crear negocio'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
            {mode === 'register' ? (
              <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
                Nombre del negocio
                <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} style={{ width: '100%' }} placeholder="Mi negocio" />
              </label>
            ) : null}

            <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} autoComplete="email" />
            </label>

            <label style={{ display: 'grid', gap: 5, fontSize: 14, fontWeight: 500, color: '#374151' }}>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%' }}
                minLength={8}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
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
              {loading
                ? (mode === 'login' ? 'Ingresando...' : 'Registrando...')
                : (mode === 'login' ? 'Entrar' : 'Registrar y entrar')}
            </button>
          </form>

          {mode === 'login' ? (
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
          ) : null}

          {error ? <div className="status-error">{error}</div> : null}
        </div>

        <p style={{ margin: '20px 0 0', fontSize: 13, color: '#64748b', textAlign: 'center' }}>
          ¿Eres cliente? Ingresa desde la página pública del negocio en Mis citas.
        </p>
      </div>
    </>
  );
}
