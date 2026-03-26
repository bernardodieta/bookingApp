import { useState } from 'react';
import { Notice } from './notice';

type OperationsTab = 'hub' | 'booking' | 'waitlist' | 'availability';

type OperationsSectionProps = {
  apiUrl: string;
  token: string;
  serviceLoading: boolean;
  staffLoading: boolean;

  onCreateService: (event: React.FormEvent) => Promise<void>;
  quickServiceName: string;
  setQuickServiceName: (value: string) => void;
  quickServiceDuration: string;
  setQuickServiceDuration: (value: string) => void;
  quickServicePrice: string;
  setQuickServicePrice: (value: string) => void;
  canSubmitQuickService: boolean;
  quickServiceLoading: boolean;
  quickServiceDisabledReason: string;
  quickServiceError: string;
  setQuickServiceError: (value: string) => void;
  quickServiceSuccess: string;
  setQuickServiceSuccess: (value: string) => void;

  onCreateStaff: (event: React.FormEvent) => Promise<void>;
  quickStaffName: string;
  setQuickStaffName: (value: string) => void;
  quickStaffEmail: string;
  setQuickStaffEmail: (value: string) => void;
  canSubmitQuickStaff: boolean;
  quickStaffLoading: boolean;
  quickStaffDisabledReason: string;
  quickStaffError: string;
  setQuickStaffError: (value: string) => void;
  quickStaffSuccess: string;
  setQuickStaffSuccess: (value: string) => void;

  onCreateBooking: (event: React.FormEvent) => Promise<void>;
  quickBookingServiceId: string;
  setQuickBookingServiceId: (value: string) => void;
  quickBookingStaffId: string;
  setQuickBookingStaffId: (value: string) => void;
  quickBookingStartAt: string;
  setQuickBookingStartAt: (value: string) => void;
  quickBookingCustomerName: string;
  setQuickBookingCustomerName: (value: string) => void;
  quickBookingCustomerEmail: string;
  setQuickBookingCustomerEmail: (value: string) => void;
  quickBookingNotes: string;
  setQuickBookingNotes: (value: string) => void;
  canSubmitQuickBooking: boolean;
  quickBookingLoading: boolean;
  quickBookingDisabledReason: string;
  quickBookingError: string;
  setQuickBookingError: (value: string) => void;
  quickBookingSuccess: string;
  setQuickBookingSuccess: (value: string) => void;

  onCreateAvailabilityRule: (event: React.FormEvent) => Promise<void>;
  quickRuleDayOfWeek: string;
  setQuickRuleDayOfWeek: (value: string) => void;
  quickRuleStartTime: string;
  setQuickRuleStartTime: (value: string) => void;
  quickRuleEndTime: string;
  setQuickRuleEndTime: (value: string) => void;
  quickRuleStaffId: string;
  setQuickRuleStaffId: (value: string) => void;
  canSubmitQuickRule: boolean;
  quickRuleLoading: boolean;
  quickRuleDisabledReason: string;
  quickRuleError: string;
  setQuickRuleError: (value: string) => void;
  quickRuleSuccess: string;
  setQuickRuleSuccess: (value: string) => void;

  onCreateAvailabilityException: (event: React.FormEvent) => Promise<void>;
  quickExceptionDate: string;
  setQuickExceptionDate: (value: string) => void;
  quickExceptionFullDay: boolean;
  setQuickExceptionFullDay: (value: boolean) => void;
  quickExceptionStartTime: string;
  setQuickExceptionStartTime: (value: string) => void;
  quickExceptionEndTime: string;
  setQuickExceptionEndTime: (value: string) => void;
  quickExceptionStaffId: string;
  setQuickExceptionStaffId: (value: string) => void;
  quickExceptionNote: string;
  setQuickExceptionNote: (value: string) => void;
  canSubmitQuickException: boolean;
  quickExceptionLoading: boolean;
  quickExceptionDisabledReason: string;
  quickExceptionError: string;
  setQuickExceptionError: (value: string) => void;
  quickExceptionSuccess: string;
  setQuickExceptionSuccess: (value: string) => void;

  onJoinWaitlist: (event: React.FormEvent) => Promise<void>;
  quickWaitlistServiceId: string;
  setQuickWaitlistServiceId: (value: string) => void;
  quickWaitlistStaffId: string;
  setQuickWaitlistStaffId: (value: string) => void;
  quickWaitlistPreferredStartAt: string;
  setQuickWaitlistPreferredStartAt: (value: string) => void;
  quickWaitlistCustomerName: string;
  setQuickWaitlistCustomerName: (value: string) => void;
  quickWaitlistCustomerEmail: string;
  setQuickWaitlistCustomerEmail: (value: string) => void;
  quickWaitlistNotes: string;
  setQuickWaitlistNotes: (value: string) => void;
  canSubmitQuickWaitlist: boolean;
  quickWaitlistLoading: boolean;
  quickWaitlistDisabledReason: string;
  quickWaitlistError: string;
  setQuickWaitlistError: (value: string) => void;
  quickWaitlistSuccess: string;
  setQuickWaitlistSuccess: (value: string) => void;

  serviceOptions: Array<{ id: string; name: string }>;
  staffOptions: Array<{ id: string; fullName: string }>;

  availabilityLoading: boolean;
  loadAvailabilityData: () => Promise<void>;
  availabilityError: string;
  setAvailabilityError: (value: string) => void;
  availabilityActionError: string;
  setAvailabilityActionError: (value: string) => void;
  availabilityActionSuccess: string;
  setAvailabilityActionSuccess: (value: string) => void;
  availabilityRules: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
    staffId: string | null;
  }>;
  availabilityExceptions: Array<{
    id: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
    isUnavailable: boolean;
    note: string | null;
    staffId: string | null;
  }>;
  availabilityActionLoadingId: string;
  onToggleAvailabilityRule: (rule: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
    staffId: string | null;
  }) => Promise<void>;
  onDeleteAvailabilityRule: (ruleId: string) => Promise<void>;
  availabilityExceptionUnavailableDrafts: Record<string, boolean>;
  setAvailabilityExceptionUnavailableDrafts: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  availabilityExceptionNoteDrafts: Record<string, string>;
  setAvailabilityExceptionNoteDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveAvailabilityException: (exceptionId: string) => Promise<void>;
  onDeleteAvailabilityException: (exceptionId: string) => Promise<void>;
};

const DAY_LABEL: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado'
};

export function OperationsSection(props: OperationsSectionProps) {
  const [tab, setTab] = useState<OperationsTab>('hub');

  return (
    <section className="section-block" style={{ marginTop: 28 }}>
      <h2 className="section-title">Operaciones</h2>

      <div className="tabbar">
        <button type="button" className={`tab-btn ${tab === 'hub' ? 'active' : ''}`} onClick={() => setTab('hub')}>
          Alta rápida
        </button>
        <button type="button" className={`tab-btn ${tab === 'booking' ? 'active' : ''}`} onClick={() => setTab('booking')}>
          Nueva cita
        </button>
        <button type="button" className={`tab-btn ${tab === 'waitlist' ? 'active' : ''}`} onClick={() => setTab('waitlist')}>
          Lista de espera
        </button>
        <button type="button" className={`tab-btn ${tab === 'availability' ? 'active' : ''}`} onClick={() => setTab('availability')}>
          Disponibilidad
        </button>
      </div>

      {tab === 'hub' ? (
        <>
          <p className="section-subtitle">Crea un servicio y un miembro del equipo para empezar a aceptar citas.</p>
          <div className="section-grid section-grid-2">
            <form onSubmit={props.onCreateService} className="panel section-form">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: '0.97rem' }}>Nuevo servicio</strong>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Nombre</span>
                <input value={props.quickServiceName} onChange={(e) => props.setQuickServiceName(e.target.value)} className="w-full" placeholder="Ej: Corte de cabello" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Duración (minutos)</span>
                <input type="number" min={5} value={props.quickServiceDuration} onChange={(e) => props.setQuickServiceDuration(e.target.value)} className="w-full" placeholder="30" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Precio</span>
                <input type="number" min={0} step="0.01" value={props.quickServicePrice} onChange={(e) => props.setQuickServicePrice(e.target.value)} className="w-full" placeholder="0.00" />
              </label>
              <button type="submit" disabled={!props.canSubmitQuickService || props.quickServiceLoading} className="btn btn-primary w-full">
                {props.quickServiceLoading ? 'Creando...' : 'Crear servicio'}
              </button>
              {!props.canSubmitQuickService && props.quickServiceDisabledReason ? (
                <div style={{ color: '#9E9B93', fontSize: 12 }}>{props.quickServiceDisabledReason}</div>
              ) : null}
              <Notice tone="error" message={props.quickServiceError} onClose={() => props.setQuickServiceError('')} />
              <Notice tone="success" message={props.quickServiceSuccess} onClose={() => props.setQuickServiceSuccess('')} />
            </form>

            <form onSubmit={props.onCreateStaff} className="panel section-form">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: '0.97rem' }}>Nuevo miembro del equipo</strong>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Nombre completo</span>
                <input value={props.quickStaffName} onChange={(e) => props.setQuickStaffName(e.target.value)} className="w-full" placeholder="Ej: María García" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Email</span>
                <input type="email" value={props.quickStaffEmail} onChange={(e) => props.setQuickStaffEmail(e.target.value)} className="w-full" placeholder="maria@ejemplo.com" />
              </label>
              <button type="submit" disabled={!props.canSubmitQuickStaff || props.quickStaffLoading} className="btn btn-primary w-full">
                {props.quickStaffLoading ? 'Creando...' : 'Agregar al equipo'}
              </button>
              {!props.canSubmitQuickStaff && props.quickStaffDisabledReason ? (
                <div style={{ color: '#9E9B93', fontSize: 12 }}>{props.quickStaffDisabledReason}</div>
              ) : null}
              <Notice tone="error" message={props.quickStaffError} onClose={() => props.setQuickStaffError('')} />
              <Notice tone="success" message={props.quickStaffSuccess} onClose={() => props.setQuickStaffSuccess('')} />
            </form>
          </div>
        </>
      ) : null}

      {tab === 'booking' ? (
        <>
          <p className="section-subtitle">Crea una reserva manual para un cliente.</p>
          <div style={{ maxWidth: 560 }}>
            <form onSubmit={props.onCreateBooking} className="panel section-form">
              <strong style={{ fontSize: '0.97rem' }}>Nueva cita</strong>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Servicio</span>
                <select value={props.quickBookingServiceId} onChange={(e) => props.setQuickBookingServiceId(e.target.value)} className="w-full" disabled={props.serviceLoading}>
                  <option value="">Seleccionar servicio</option>
                  {props.serviceOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Profesional</span>
                <select value={props.quickBookingStaffId} onChange={(e) => props.setQuickBookingStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
                  <option value="">Seleccionar profesional</option>
                  {props.staffOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.fullName}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Fecha y hora</span>
                <input type="datetime-local" value={props.quickBookingStartAt} onChange={(e) => props.setQuickBookingStartAt(e.target.value)} className="w-full" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Nombre del cliente</span>
                <input value={props.quickBookingCustomerName} onChange={(e) => props.setQuickBookingCustomerName(e.target.value)} className="w-full" placeholder="Nombre completo" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Email del cliente</span>
                <input type="email" value={props.quickBookingCustomerEmail} onChange={(e) => props.setQuickBookingCustomerEmail(e.target.value)} className="w-full" placeholder="cliente@ejemplo.com" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Notas (opcional)</span>
                <input value={props.quickBookingNotes} onChange={(e) => props.setQuickBookingNotes(e.target.value)} className="w-full" placeholder="Indicaciones especiales..." />
              </label>
              <button type="submit" disabled={!props.canSubmitQuickBooking || props.quickBookingLoading} className="btn btn-primary w-full">
                {props.quickBookingLoading ? 'Creando...' : 'Crear cita'}
              </button>
              {!props.canSubmitQuickBooking && props.quickBookingDisabledReason ? (
                <div style={{ color: '#9E9B93', fontSize: 12 }}>{props.quickBookingDisabledReason}</div>
              ) : null}
              <Notice tone="error" message={props.quickBookingError} onClose={() => props.setQuickBookingError('')} />
              <Notice tone="success" message={props.quickBookingSuccess} onClose={() => props.setQuickBookingSuccess('')} />
            </form>
          </div>
        </>
      ) : null}

      {tab === 'waitlist' ? (
        <>
          <p className="section-subtitle">Agrega un cliente a la lista de espera.</p>
          <div style={{ maxWidth: 560 }}>
            <form onSubmit={props.onJoinWaitlist} className="panel section-form">
              <strong style={{ fontSize: '0.97rem' }}>Lista de espera</strong>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Servicio</span>
                <select value={props.quickWaitlistServiceId} onChange={(e) => props.setQuickWaitlistServiceId(e.target.value)} className="w-full" disabled={props.serviceLoading}>
                  <option value="">Seleccionar servicio</option>
                  {props.serviceOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Profesional</span>
                <select value={props.quickWaitlistStaffId} onChange={(e) => props.setQuickWaitlistStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
                  <option value="">Cualquier profesional</option>
                  {props.staffOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.fullName}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Fecha y hora preferida</span>
                <input type="datetime-local" value={props.quickWaitlistPreferredStartAt} onChange={(e) => props.setQuickWaitlistPreferredStartAt(e.target.value)} className="w-full" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Nombre del cliente</span>
                <input value={props.quickWaitlistCustomerName} onChange={(e) => props.setQuickWaitlistCustomerName(e.target.value)} className="w-full" placeholder="Nombre completo" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Email del cliente</span>
                <input type="email" value={props.quickWaitlistCustomerEmail} onChange={(e) => props.setQuickWaitlistCustomerEmail(e.target.value)} className="w-full" placeholder="cliente@ejemplo.com" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Notas (opcional)</span>
                <input value={props.quickWaitlistNotes} onChange={(e) => props.setQuickWaitlistNotes(e.target.value)} className="w-full" placeholder="Indicaciones especiales..." />
              </label>
              <button type="submit" disabled={!props.canSubmitQuickWaitlist || props.quickWaitlistLoading} className="btn btn-primary w-full">
                {props.quickWaitlistLoading ? 'Agregando...' : 'Agregar a lista de espera'}
              </button>
              {!props.canSubmitQuickWaitlist && props.quickWaitlistDisabledReason ? (
                <div style={{ color: '#9E9B93', fontSize: 12 }}>{props.quickWaitlistDisabledReason}</div>
              ) : null}
              <Notice tone="error" message={props.quickWaitlistError} onClose={() => props.setQuickWaitlistError('')} />
              <Notice tone="success" message={props.quickWaitlistSuccess} onClose={() => props.setQuickWaitlistSuccess('')} />
            </form>
          </div>
        </>
      ) : null}

      {tab === 'availability' ? (
        <>
          <p className="section-subtitle">Gestiona los horarios disponibles y excepciones del negocio.</p>

          <div className="section-grid section-grid-2" style={{ marginBottom: 16 }}>
            <form onSubmit={props.onCreateAvailabilityRule} className="panel section-form">
              <strong style={{ fontSize: '0.97rem' }}>Nueva regla de disponibilidad</strong>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Día de la semana</span>
                <select value={props.quickRuleDayOfWeek} onChange={(e) => props.setQuickRuleDayOfWeek(e.target.value)} className="w-full">
                  <option value="1">Lunes</option>
                  <option value="2">Martes</option>
                  <option value="3">Miércoles</option>
                  <option value="4">Jueves</option>
                  <option value="5">Viernes</option>
                  <option value="6">Sábado</option>
                  <option value="0">Domingo</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Hora inicio</span>
                <input type="time" value={props.quickRuleStartTime} onChange={(e) => props.setQuickRuleStartTime(e.target.value)} className="w-full" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Hora fin</span>
                <input type="time" value={props.quickRuleEndTime} onChange={(e) => props.setQuickRuleEndTime(e.target.value)} className="w-full" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Profesional (opcional)</span>
                <select value={props.quickRuleStaffId} onChange={(e) => props.setQuickRuleStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
                  <option value="">Todos los profesionales</option>
                  {props.staffOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.fullName}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={!props.canSubmitQuickRule || props.quickRuleLoading} className="btn btn-primary w-full">
                {props.quickRuleLoading ? 'Creando...' : 'Crear regla'}
              </button>
              {!props.canSubmitQuickRule && props.quickRuleDisabledReason ? (
                <div style={{ color: '#9E9B93', fontSize: 12 }}>{props.quickRuleDisabledReason}</div>
              ) : null}
              <Notice tone="error" message={props.quickRuleError} onClose={() => props.setQuickRuleError('')} />
              <Notice tone="success" message={props.quickRuleSuccess} onClose={() => props.setQuickRuleSuccess('')} />
            </form>

            <form onSubmit={props.onCreateAvailabilityException} className="panel section-form">
              <strong style={{ fontSize: '0.97rem' }}>Nueva excepción</strong>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Fecha</span>
                <input type="date" value={props.quickExceptionDate} onChange={(e) => props.setQuickExceptionDate(e.target.value)} className="w-full" />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={props.quickExceptionFullDay} onChange={(e) => props.setQuickExceptionFullDay(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Bloquear todo el día</span>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Hora inicio</span>
                <input type="time" value={props.quickExceptionStartTime} onChange={(e) => props.setQuickExceptionStartTime(e.target.value)} className="w-full" disabled={props.quickExceptionFullDay} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Hora fin</span>
                <input type="time" value={props.quickExceptionEndTime} onChange={(e) => props.setQuickExceptionEndTime(e.target.value)} className="w-full" disabled={props.quickExceptionFullDay} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Profesional (opcional)</span>
                <select value={props.quickExceptionStaffId} onChange={(e) => props.setQuickExceptionStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
                  <option value="">Todos los profesionales</option>
                  {props.staffOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.fullName}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#5E5C55' }}>Nota (opcional)</span>
                <input value={props.quickExceptionNote} onChange={(e) => props.setQuickExceptionNote(e.target.value)} className="w-full" placeholder="Ej: Feriado nacional" />
              </label>
              <button type="submit" disabled={!props.canSubmitQuickException || props.quickExceptionLoading} className="btn btn-primary w-full">
                {props.quickExceptionLoading ? 'Creando...' : 'Crear excepción'}
              </button>
              {!props.canSubmitQuickException && props.quickExceptionDisabledReason ? (
                <div style={{ color: '#9E9B93', fontSize: 12 }}>{props.quickExceptionDisabledReason}</div>
              ) : null}
              <Notice tone="error" message={props.quickExceptionError} onClose={() => props.setQuickExceptionError('')} />
              <Notice tone="success" message={props.quickExceptionSuccess} onClose={() => props.setQuickExceptionSuccess('')} />
            </form>
          </div>

          <div className="section-actions" style={{ marginBottom: 12 }}>
            <button
              type="button"
              disabled={props.availabilityLoading || !props.token.trim()}
              onClick={() => { void props.loadAvailabilityData(); }}
              className="btn btn-ghost"
            >
              {props.availabilityLoading ? 'Cargando...' : 'Actualizar disponibilidad'}
            </button>
          </div>

          <Notice tone="error" message={props.availabilityError} withMargin onClose={() => props.setAvailabilityError('')} />
          <Notice tone="error" message={props.availabilityActionError} withMargin onClose={() => props.setAvailabilityActionError('')} />

          <div className="section-grid section-grid-2">
            <div className="panel">
              <strong style={{ fontSize: '0.95rem' }}>Reglas activas</strong>
              <div className="table-wrap" style={{ marginTop: 10 }}>
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Horario</th>
                      <th>Profesional</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.availabilityRules.map((rule) => (
                      <tr key={rule.id}>
                        <td>{DAY_LABEL[rule.dayOfWeek] ?? String(rule.dayOfWeek)}</td>
                        <td>{rule.startTime} – {rule.endTime}</td>
                        <td>{props.staffOptions.find((e) => e.id === rule.staffId)?.fullName ?? '-'}</td>
                        <td>
                          <span style={{ color: rule.isActive ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>
                            {rule.isActive ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td>
                          <div className="section-actions" style={{ gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => { void props.onToggleAvailabilityRule(rule); }}
                              disabled={props.availabilityActionLoadingId === `rule-toggle-${rule.id}` || props.availabilityActionLoadingId === `rule-delete-${rule.id}`}
                              className="btn btn-ghost"
                              style={{ fontSize: 12, padding: '6px 10px' }}
                            >
                              {props.availabilityActionLoadingId === `rule-toggle-${rule.id}` ? '...' : rule.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { void props.onDeleteAvailabilityRule(rule.id); }}
                              disabled={props.availabilityActionLoadingId === `rule-delete-${rule.id}` || props.availabilityActionLoadingId === `rule-toggle-${rule.id}`}
                              className="btn btn-ghost"
                              style={{ fontSize: 12, padding: '6px 10px', color: 'var(--danger)' }}
                            >
                              {props.availabilityActionLoadingId === `rule-delete-${rule.id}` ? '...' : 'Eliminar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!props.availabilityRules.length ? (
                      <tr><td colSpan={5} className="table-empty">Sin reglas configuradas.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <strong style={{ fontSize: '0.95rem' }}>Excepciones</strong>
              <div className="table-wrap" style={{ marginTop: 10 }}>
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Horario</th>
                      <th>Profesional</th>
                      <th>Tipo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.availabilityExceptions.map((exception) => (
                      <tr key={exception.id}>
                        <td>{new Date(exception.date).toLocaleDateString()}</td>
                        <td>{exception.startTime && exception.endTime ? `${exception.startTime} – ${exception.endTime}` : 'Todo el día'}</td>
                        <td>{props.staffOptions.find((e) => e.id === exception.staffId)?.fullName ?? '-'}</td>
                        <td>{(props.availabilityExceptionUnavailableDrafts[exception.id] ?? exception.isUnavailable) ? 'No disponible' : 'Disponible'}</td>
                        <td>
                          <div className="section-form" style={{ gap: 6 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={props.availabilityExceptionUnavailableDrafts[exception.id] ?? exception.isUnavailable}
                                onChange={(e) =>
                                  props.setAvailabilityExceptionUnavailableDrafts((cur) => ({ ...cur, [exception.id]: e.target.checked }))
                                }
                              />
                              <span style={{ fontSize: 12 }}>No disponible</span>
                            </label>
                            <input
                              value={props.availabilityExceptionNoteDrafts[exception.id] ?? exception.note ?? ''}
                              onChange={(e) =>
                                props.setAvailabilityExceptionNoteDrafts((cur) => ({ ...cur, [exception.id]: e.target.value }))
                              }
                              placeholder="Nota"
                              className="w-full"
                            />
                            <div className="section-actions" style={{ gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => { void props.onSaveAvailabilityException(exception.id); }}
                                disabled={props.availabilityActionLoadingId === `exception-save-${exception.id}` || props.availabilityActionLoadingId === `exception-delete-${exception.id}`}
                                className="btn btn-primary"
                                style={{ fontSize: 12, padding: '6px 10px' }}
                              >
                                {props.availabilityActionLoadingId === `exception-save-${exception.id}` ? '...' : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { void props.onDeleteAvailabilityException(exception.id); }}
                                disabled={props.availabilityActionLoadingId === `exception-delete-${exception.id}` || props.availabilityActionLoadingId === `exception-save-${exception.id}`}
                                className="btn btn-ghost"
                                style={{ fontSize: 12, padding: '6px 10px', color: 'var(--danger)' }}
                              >
                                {props.availabilityActionLoadingId === `exception-delete-${exception.id}` ? '...' : 'Eliminar'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!props.availabilityExceptions.length ? (
                      <tr><td colSpan={5} className="table-empty">Sin excepciones configuradas.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
