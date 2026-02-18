'use client';

import Script from 'next/script';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Building2, LogIn, UserPlus } from 'lucide-react';

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
      <main className="app-shell" style={{ maxWidth: 640 }}>
      <section className="surface" style={{ padding: 22 }}>
        <header className="page-header" style={{ marginBottom: 12 }}>
          <div>
            <h1 className="page-title">{mode === 'login' ? 'Apoint Login' : 'Crear negocio'}</h1>
            <p className="page-subtitle">
              {mode === 'login' ? 'Inicia sesión para usar tu dashboard.' : 'Registra tu cuenta owner y entra en un paso.'}
            </p>
          </div>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: '#eaf1ff', display: 'grid', placeItems: 'center' }}>
            {mode === 'login' ? <LogIn size={22} color="#1d4ed8" /> : <Building2 size={22} color="#1d4ed8" />}
          </div>
        </header>

      <div className="panel" style={{ marginBottom: 12, background: 'var(--surface-muted)' }}>
        <div style={{ fontSize: 13, color: '#555' }}>
          Este acceso es para negocio/partners (dashboard). Si eres cliente final, ingresa desde la página pública del negocio y abre <strong>“Portal cliente / Mis citas”</strong>.
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError('');
            setGoogleReady(false);
            setGoogleInitKey((value) => value + 1);
          }}
          disabled={loading || mode === 'login'}
          className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`}
        >
          <LogIn size={16} />
          Ya tengo cuenta
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError('');
            setGoogleReady(false);
          }}
          disabled={loading || mode === 'register'}
          className={`btn ${mode === 'register' ? 'btn-primary' : 'btn-ghost'}`}
        >
          <UserPlus size={16} />
          Crear negocio
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          API URL
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} style={{ width: '100%' }} />
        </label>
        {mode === 'register' ? (
          <label>
            Nombre del negocio
            <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} style={{ width: '100%' }} />
          </label>
        ) : null}
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%' }} />
        </label>
        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: 220 }}>
          {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
          {loading ? (mode === 'login' ? 'Ingresando...' : 'Registrando...') : mode === 'login' ? 'Entrar' : 'Registrar y entrar'}
        </button>
      </form>

      {mode === 'login' ? (
        <div className="panel" style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          <strong>Google SSO (partners)</strong>
          {!GOOGLE_CLIENT_ID ? <span style={{ color: '#666', fontSize: 13 }}>Configura `NEXT_PUBLIC_GOOGLE_CLIENT_ID` para habilitar Google SSO.</span> : null}
          {googleLoading ? <span style={{ color: '#666', fontSize: 13 }}>Validando sesión de Google...</span> : null}
          {GOOGLE_CLIENT_ID ? <div ref={setGoogleButtonNode} /> : null}
          {GOOGLE_CLIENT_ID && googleScriptLoaded && !googleReady ? (
            <span style={{ color: '#666', fontSize: 13 }}>Cargando botón de Google...</span>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="status-error" style={{ marginTop: 14 }}>{error}</div> : null}
      </section>
    </main>
    </>
  );
}
