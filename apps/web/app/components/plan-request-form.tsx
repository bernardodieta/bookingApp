'use client';

import { FormEvent, useState } from 'react';
import { z } from 'zod';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  businessName: z.string().min(1, 'El nombre del negocio es obligatorio'),
  message: z.string().max(500).optional(),
});

type PlanRequestFormProps = {
  selectedPlan: 'free' | 'pro' | 'business';
  onClose: () => void;
};

export default function PlanRequestForm({ selectedPlan, onClose }: PlanRequestFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const parsed = schema.safeParse({ name, email, phone: phone || undefined, businessName, message: message || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/public/plan-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          businessName,
          requestedPlan: selectedPlan,
          message: message || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la solicitud');
    } finally {
      setSending(false);
    }
  }

  const planLabels = { free: 'Free', pro: 'Pro', business: 'Business' };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)', padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel" style={{ width: '100%', maxWidth: 480, padding: 32, display: 'grid', gap: 16 }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div className="status-success" style={{ marginBottom: 16 }}>
              Solicitud enviada correctamente. Nos pondremos en contacto contigo pronto.
            </div>
            <button type="button" onClick={onClose} className="btn btn-primary">Cerrar</button>
          </div>
        ) : (
          <>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Solicitar plan {planLabels[selectedPlan]}</h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Completa tus datos y te contactaremos para activar tu cuenta.
              </p>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                Nombre completo *
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Tu nombre" className="w-full" />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                Email *
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" className="w-full" />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                Teléfono (opcional)
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+52 55 1234 5678" className="w-full" />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                Nombre del negocio *
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required placeholder="Mi Consultorio" className="w-full" />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                Mensaje (opcional)
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Cuéntanos sobre tu negocio..."
                  maxLength={500}
                  rows={3}
                  className="w-full"
                />
              </label>
              {error ? <div className="status-error" style={{ fontSize: 13 }}>{error}</div> : null}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={sending} className="btn btn-primary" style={{ flex: 1 }}>
                  {sending ? 'Enviando...' : 'Enviar solicitud'}
                </button>
                <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
