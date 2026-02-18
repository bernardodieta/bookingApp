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

export default function LoginPage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState('http://localhost:3001');
  const [email, setEmail] = useState('owner.policies@demo.com');
  const [password, setPassword] = useState('Password123');
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

    const parsed = loginSchema.safeParse({
      apiUrl: apiUrl.trim(),
      email: email.trim(),
      password
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(new URL('/auth/login', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password
        })
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
      localStorage.setItem(API_URL_KEY, parsed.data.apiUrl);
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
      <h1 style={{ marginBottom: 8 }}>Apoint Login</h1>
      <p style={{ marginTop: 0, color: '#555' }}>Inicia sesión para usar el dashboard operativo.</p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <label>
          API URL
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%' }} />
        </label>
        <button type="submit" disabled={loading} style={{ width: 180, padding: '8px 12px' }}>
          {loading ? 'Ingresando...' : 'Entrar'}
        </button>
      </form>

      {error ? <div style={{ marginTop: 12, background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{error}</div> : null}
    </main>
  );
}
