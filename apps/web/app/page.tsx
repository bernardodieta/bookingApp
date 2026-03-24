'use client';

import { useState } from 'react';
import { CalendarDays, Users, Globe, Bell, CalendarCheck } from 'lucide-react';
import PlanRequestForm from './components/plan-request-form';

type PlanKey = 'free' | 'pro' | 'business';

const PLANS: { key: PlanKey; name: string; price: string; features: string[]; recommended?: boolean }[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0/mes',
    features: ['1 staff', '50 citas/mes', 'Página pública', 'Notificaciones email'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'Contactar',
    recommended: true,
    features: ['5 staff', 'Citas ilimitadas', 'Dominio personalizado', 'Widget embebible', 'Reportes'],
  },
  {
    key: 'business',
    name: 'Business',
    price: 'Contactar',
    features: ['Staff ilimitado', 'Todo de Pro', 'Integraciones calendario', 'Soporte prioritario'],
  },
];

export default function LandingPage() {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);

  return (
    <>
      {/* Nav */}
      <nav style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sidebar-logo">
            <CalendarCheck size={18} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 18 }}>Apoint</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="#pricing" className="btn btn-ghost" style={{ fontSize: 13 }}>Ver planes</a>
          <a href="/login" className="btn btn-primary" style={{ fontSize: 13 }}>Iniciar sesión</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: '0 0 16px', lineHeight: 1.15 }}>
          Gestiona tus citas de forma<br />simple y profesional
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 1.5vw, 1.2rem)', color: 'var(--text-muted)', maxWidth: 600, margin: '0 auto 32px' }}>
          La plataforma todo-en-uno para agendar, confirmar y organizar las citas de tu negocio.
        </p>
        <a href="#pricing" className="btn btn-primary" style={{ fontSize: 16, padding: '14px 32px' }}>
          Comenzar gratis
        </a>
      </section>

      {/* Features */}
      <section className="landing-section">
        <div className="landing-features">
          {[
            { icon: <CalendarDays size={24} />, title: 'Agenda inteligente', desc: 'Gestiona horarios, disponibilidad y reservas en un solo lugar.' },
            { icon: <Users size={24} />, title: 'Multi-staff', desc: 'Cada miembro de tu equipo con su propia agenda y disponibilidad.' },
            { icon: <Globe size={24} />, title: 'Portal de reservas', desc: 'Tus clientes agendan directamente desde tu link personalizado.' },
            { icon: <Bell size={24} />, title: 'Recordatorios', desc: 'Notificaciones automáticas por email para reducir ausencias.' },
          ].map((f) => (
            <div key={f.title} className="panel" style={{ padding: 24, display: 'grid', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: '#EFF8F5', color: '#1A8E69', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {f.icon}
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section" style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 600, marginBottom: 32, letterSpacing: '-0.01em' }}>
          Cómo funciona
        </h2>
        <div className="landing-steps">
          {[
            { step: '1', title: 'Configura tu negocio', desc: 'Define servicios, horarios y equipo en minutos.' },
            { step: '2', title: 'Comparte tu link', desc: 'Tus clientes reservan desde cualquier dispositivo.' },
            { step: '3', title: 'Gestiona todo', desc: 'Confirma, reagenda o cancela desde tu panel.' },
          ].map((s) => (
            <div key={s.step} style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 18 }}>
                {s.step}
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="landing-section" style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 600, marginBottom: 32, letterSpacing: '-0.01em' }}>
          Planes
        </h2>
        <div className="landing-pricing">
          {PLANS.map((plan) => (
            <div key={plan.key} className={`landing-plan-card${plan.recommended ? ' recommended' : ''}`}>
              {plan.recommended ? (
                <span style={{ justifySelf: 'center', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: '#EFF8F5', color: '#1A8E69' }}>
                  Recomendado
                </span>
              ) : null}
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{plan.name}</h3>
                <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'var(--font-display)', marginTop: 8 }}>{plan.price}</div>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8, textAlign: 'left' }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 14, color: 'var(--text-muted)', paddingLeft: 20, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--success)' }}>&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`btn ${plan.recommended ? 'btn-primary' : 'btn-ghost'}`}
                style={{ width: '100%' }}
                onClick={() => setSelectedPlan(plan.key)}
              >
                Solicitar
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="landing-section" style={{ textAlign: 'center', paddingBottom: 80 }}>
        <h2 style={{ fontSize: 'clamp(1.3rem, 2vw, 1.8rem)', fontWeight: 600, marginBottom: 16 }}>
          ¿Listo para simplificar tu agenda?
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 15 }}>
          Empieza gratis, sin tarjeta de crédito.
        </p>
        <button type="button" className="btn btn-primary" style={{ fontSize: 16, padding: '14px 32px' }} onClick={() => setSelectedPlan('free')}>
          Comenzar ahora
        </button>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1.5px solid var(--border)', padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div className="sidebar-logo" style={{ width: 24, height: 24, borderRadius: 6 }}>
            <CalendarCheck size={14} />
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Apoint</span>
        </div>
        © {new Date().getFullYear()} Apoint. Todos los derechos reservados.
      </footer>

      {/* Plan Request Form Modal */}
      {selectedPlan ? (
        <PlanRequestForm selectedPlan={selectedPlan} onClose={() => setSelectedPlan(null)} />
      ) : null}
    </>
  );
}
