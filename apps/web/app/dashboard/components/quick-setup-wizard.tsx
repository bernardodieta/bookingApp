'use client';

import { useState } from 'react';
import { quickCreateServiceSchema, quickCreateStaffSchema } from '../dashboard-schemas';
import { type ServiceItem, type StaffMember } from '../dashboard-types';
import { Notice } from './notice';

type Step = 1 | 2 | 3;

type QuickSetupWizardProps = {
  apiUrl: string;
  token: string;
  serviceOptions: ServiceItem[];
  onServiceCreated: (service: ServiceItem) => void;
  onStaffCreated: (staff: StaffMember) => void;
  onNavigateToStaff: () => void;
  onNavigateToServices: () => void;
};

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: Array<{ n: Step; label: string }> = [
    { n: 1, label: 'Servicio' },
    { n: 2, label: 'Staff' },
    { n: 3, label: '¡Listo!' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 24 }}>
      {steps.map((s, i) => {
        const done = (s.n as number) < (currentStep as number);
        const active = s.n === currentStep;
        const circleColor = done ? '#2EBF8F' : active ? '#2EBF8F' : '#D8D5CF';
        const textColor = done || active ? '#fff' : '#9E9B93';
        const labelColor = active ? '#2EBF8F' : done ? '#2EBF8F' : '#9E9B93';

        return (
          <div
            key={s.n}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              flex: i < steps.length - 1 ? 1 : 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 13,
                  background: circleColor,
                  color: textColor,
                  transition: 'background 0.25s',
                  flexShrink: 0,
                }}
              >
                {done ? '✓' : s.n}
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: labelColor,
                  fontWeight: active ? 600 : 400,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.25s',
                }}
              >
                {s.label}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: (currentStep as number) > (s.n as number) ? '#2EBF8F' : '#D8D5CF',
                  margin: '14px 8px 0',
                  transition: 'background 0.25s',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QuickSetupWizard(props: QuickSetupWizardProps) {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — Servicio
  const [usePicker, setUsePicker] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState('60');
  const [servicePrice, setServicePrice] = useState('0');
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [createdService, setCreatedService] = useState<ServiceItem | null>(null);

  // Step 2 — Staff
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [createdStaff, setCreatedStaff] = useState<StaffMember | null>(null);

  function reset() {
    setStep(1);
    setUsePicker(false);
    setSelectedExistingId('');
    setServiceName('');
    setServiceDuration('60');
    setServicePrice('0');
    setServiceLoading(false);
    setServiceError('');
    setCreatedService(null);
    setStaffName('');
    setStaffEmail('');
    setStaffLoading(false);
    setStaffError('');
    setCreatedStaff(null);
  }

  async function handleServiceNext() {
    setServiceError('');

    if (usePicker) {
      if (!selectedExistingId) {
        setServiceError('Selecciona un servicio de la lista.');
        return;
      }
      const found = props.serviceOptions.find((s) => s.id === selectedExistingId) ?? null;
      setCreatedService(found);
      setStep(2);
      return;
    }

    const parsed = quickCreateServiceSchema.safeParse({
      apiUrl: props.apiUrl,
      token: props.token,
      name: serviceName,
      durationMinutes: serviceDuration,
      price: servicePrice,
    });

    if (!parsed.success) {
      setServiceError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
      return;
    }

    setServiceLoading(true);
    try {
      const response = await fetch(new URL('/services', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`,
        },
        body: JSON.stringify({
          name: parsed.data.name,
          durationMinutes: parsed.data.durationMinutes,
          price: parsed.data.price,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const created = (await response.json()) as ServiceItem;
      setCreatedService(created);
      props.onServiceCreated(created);
      setStep(2);
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : 'No se pudo crear el servicio.');
    } finally {
      setServiceLoading(false);
    }
  }

  async function handleStaffFinish() {
    setStaffError('');

    const parsed = quickCreateStaffSchema.safeParse({
      apiUrl: props.apiUrl,
      token: props.token,
      fullName: staffName,
      email: staffEmail,
    });

    if (!parsed.success) {
      setStaffError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
      return;
    }

    setStaffLoading(true);
    try {
      const response = await fetch(new URL('/staff', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`,
        },
        body: JSON.stringify({
          fullName: parsed.data.fullName,
          email: parsed.data.email,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const created = (await response.json()) as StaffMember;
      setCreatedStaff(created);
      props.onStaffCreated(created);
      setStep(3);
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'No se pudo crear el staff.');
    } finally {
      setStaffLoading(false);
    }
  }

  const canSubmitService = usePicker
    ? !!selectedExistingId
    : serviceName.trim().length > 0 &&
      Number(serviceDuration) >= 5 &&
      Number(servicePrice) >= 0;

  const canSubmitStaff =
    staffName.trim().length > 0 && staffEmail.trim().includes('@');

  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <StepIndicator currentStep={step} />

      {/* ── PASO 1: SERVICIO ── */}
      {step === 1 && (
        <div className="section-form">
          <div>
            <strong style={{ fontSize: '1rem' }}>Paso 1 — Definir servicio</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Cada cita está asociada a un servicio. Crea uno nuevo o elige uno ya existente.
            </p>
          </div>

          {props.serviceOptions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setUsePicker(false); }}
                className={`btn ${!usePicker ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 13, padding: '6px 14px' }}
              >
                Crear nuevo
              </button>
              <button
                type="button"
                onClick={() => { setUsePicker(true); }}
                className={`btn ${usePicker ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 13, padding: '6px 14px' }}
              >
                Usar existente
              </button>
            </div>
          )}

          {usePicker ? (
            <label>
              Selecciona el servicio
              <select
                value={selectedExistingId}
                onChange={(e) => setSelectedExistingId(e.target.value)}
                className="w-full"
              >
                <option value="">Seleccionar...</option>
                {props.serviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                Nombre del servicio
                <input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full"
                  placeholder="ej. Consulta general"
                />
              </label>
              <label>
                Duración (min)
                <input
                  type="number"
                  min={5}
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(e.target.value)}
                  className="w-full"
                />
              </label>
              <label>
                Precio
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={servicePrice}
                  onChange={(e) => setServicePrice(e.target.value)}
                  className="w-full"
                />
              </label>
            </>
          )}

          <Notice tone="error" message={serviceError} onClose={() => setServiceError('')} />

          <button
            type="button"
            onClick={() => { void handleServiceNext(); }}
            disabled={!canSubmitService || serviceLoading}
            className="btn btn-primary section-button-md"
          >
            {serviceLoading ? 'Creando...' : 'Siguiente →'}
          </button>
        </div>
      )}

      {/* ── PASO 2: STAFF ── */}
      {step === 2 && (
        <div className="section-form">
          <div>
            <strong style={{ fontSize: '1rem' }}>Paso 2 — Agregar staff</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              El staff atiende los servicios. Puedes añadir más miembros desde la sección <em>Equipo</em>.
            </p>
          </div>

          {createdService && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#EFF8F5',
                color: '#1A8E69',
                border: '1.5px solid #C8EDE1',
                borderRadius: 4,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                alignSelf: 'flex-start',
              }}
            >
              ✓ Servicio: {createdService.name}
            </div>
          )}

          <label>
            Nombre completo
            <input
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="w-full"
              placeholder="ej. Dra. Ana López"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              className="w-full"
              placeholder="ana@clinica.com"
            />
          </label>

          <Notice tone="error" message={staffError} onClose={() => setStaffError('')} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn btn-ghost"
            >
              ← Atrás
            </button>
            <button
              type="button"
              onClick={() => { void handleStaffFinish(); }}
              disabled={!canSubmitStaff || staffLoading}
              className="btn btn-primary section-button-md"
            >
              {staffLoading ? 'Creando...' : 'Finalizar'}
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="btn btn-ghost"
              style={{ color: '#9E9B93', fontSize: 13 }}
            >
              Omitir por ahora
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 3: RESUMEN ── */}
      {step === 3 && (
        <div className="section-form">
          <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
            <div style={{ fontSize: 38, lineHeight: 1 }}>🎉</div>
            <strong style={{ fontSize: '1.05rem', display: 'block', marginTop: 10 }}>
              ¡Configuración completada!
            </strong>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
              Ya tienes lo necesario para empezar a recibir citas.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {createdService && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: '#EFF8F5',
                  border: '1.5px solid #C8EDE1',
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 18 }}>📋</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Servicio creado</div>
                  <div style={{ color: '#2EBF8F', fontSize: 13 }}>{createdService.name}</div>
                </div>
              </div>
            )}

            {createdStaff ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: '#EFF8F5',
                  border: '1.5px solid #C8EDE1',
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 18 }}>👤</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Staff añadido</div>
                  <div style={{ color: '#2EBF8F', fontSize: 13 }}>{createdStaff.fullName}</div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: '#FAEEDA',
                  border: '1.5px solid #FAEEDA',
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div style={{ fontSize: 13, color: '#BA7517' }}>
                  No se añadió staff. Puedes hacerlo desde <em>Equipo</em> cuando quieras.
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <button
              type="button"
              onClick={props.onNavigateToStaff}
              className="btn btn-ghost"
            >
              Ir a Equipo
            </button>
            <button
              type="button"
              onClick={props.onNavigateToServices}
              className="btn btn-ghost"
            >
              Ir a Servicios
            </button>
            <button
              type="button"
              onClick={reset}
              className="btn btn-primary section-button-md"
            >
              Crear otro conjunto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
