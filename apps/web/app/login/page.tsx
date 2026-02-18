'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

const TOKEN_KEY = 'apoint.dashboard.token';
const API_URL_KEY = 'apoint.dashboard.apiUrl';

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

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>{mode === 'login' ? 'Apoint Login' : 'Apoint Registro'}</h1>
      <p style={{ marginTop: 0, color: '#555' }}>
        {mode === 'login' ? 'Inicia sesión para usar el dashboard operativo.' : 'Registra tu negocio (owner) para crear tu tenant.'}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError('');
          }}
          disabled={loading || mode === 'login'}
          style={{ width: 180, padding: '8px 12px' }}
        >
          Ya tengo cuenta
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError('');
          }}
          disabled={loading || mode === 'register'}
          style={{ width: 180, padding: '8px 12px' }}
        >
          Crear negocio
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
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
        <button type="submit" disabled={loading} style={{ width: 180, padding: '8px 12px' }}>
          {loading ? (mode === 'login' ? 'Ingresando...' : 'Registrando...') : mode === 'login' ? 'Entrar' : 'Registrar y entrar'}
        </button>
      </form>

      {error ? <div style={{ marginTop: 12, background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{error}</div> : null}
    </main>
  );
}
