import { Notice } from './notice';

type OperationsSectionProps = {
  operationsView:
    | 'quick-service'
    | 'quick-staff'
    | 'quick-booking'
    | 'quick-waitlist'
    | 'availability-rules'
    | 'availability-exceptions'
    | 'availability-overview';
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

const DAY_OF_WEEK_LABEL: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado'
};

export function OperationsSection(props: OperationsSectionProps) {
  const isQuickView = props.operationsView.startsWith('quick-');
  const isAvailabilityView = props.operationsView.startsWith('availability-');

  const quickViewTitle: Record<'quick-service' | 'quick-staff' | 'quick-booking' | 'quick-waitlist', string> = {
    'quick-service': 'Crear servicio',
    'quick-staff': 'Crear staff',
    'quick-booking': 'Crear booking',
    'quick-waitlist': 'Join waitlist'
  };

  const quickViewSubtitle: Record<'quick-service' | 'quick-staff' | 'quick-booking' | 'quick-waitlist', string> = {
    'quick-service': 'Alta rápida de un nuevo servicio del negocio.',
    'quick-staff': 'Alta rápida de un miembro del staff.',
    'quick-booking': 'Crear una reserva manual para un cliente.',
    'quick-waitlist': 'Agregar un cliente a lista de espera.'
  };

  const showRulesPanel = props.operationsView === 'availability-overview' || props.operationsView === 'availability-rules';
  const showExceptionsPanel = props.operationsView === 'availability-overview' || props.operationsView === 'availability-exceptions';
  const showRulesForm = props.operationsView === 'availability-rules';
  const showExceptionsForm = props.operationsView === 'availability-exceptions';

  return (
    <>
      {isQuickView ? (
        <section className="section-block" style={{ marginTop: 28 }}>
          <h2 className="section-title">{quickViewTitle[props.operationsView as 'quick-service' | 'quick-staff' | 'quick-booking' | 'quick-waitlist']}</h2>
          <p className="section-subtitle">{quickViewSubtitle[props.operationsView as 'quick-service' | 'quick-staff' | 'quick-booking' | 'quick-waitlist']}</p>

          <div className="section-grid section-grid-2" style={{ marginBottom: 8 }}>
            {props.operationsView === 'quick-service' ? (
              <form onSubmit={props.onCreateService} className="panel section-form" style={{ gap: 8 }}>
                <strong>Crear servicio</strong>
                <label>
                  Nombre
                  <input value={props.quickServiceName} onChange={(e) => props.setQuickServiceName(e.target.value)} className="w-full" />
                </label>
                <label>
                  Duración (min)
                  <input type="number" min={5} value={props.quickServiceDuration} onChange={(e) => props.setQuickServiceDuration(e.target.value)} className="w-full" />
                </label>
                <label>
                  Precio
                  <input type="number" min={0} step="0.01" value={props.quickServicePrice} onChange={(e) => props.setQuickServicePrice(e.target.value)} className="w-full" />
                </label>
                <button type="submit" disabled={!props.canSubmitQuickService} className="btn btn-primary section-button-md">
                  {props.quickServiceLoading ? 'Creando...' : 'Crear servicio'}
                </button>
                {!props.canSubmitQuickService && props.quickServiceDisabledReason ? <div style={{ color: '#666', fontSize: 12 }}>{props.quickServiceDisabledReason}</div> : null}
                <Notice tone="error" message={props.quickServiceError} onClose={() => props.setQuickServiceError('')} />
                <Notice tone="success" message={props.quickServiceSuccess} onClose={() => props.setQuickServiceSuccess('')} />
              </form>
            ) : null}

            {props.operationsView === 'quick-staff' ? (
              <form onSubmit={props.onCreateStaff} className="panel section-form" style={{ gap: 8 }}>
                <strong>Crear staff</strong>
                <label>
                  Nombre completo
                  <input value={props.quickStaffName} onChange={(e) => props.setQuickStaffName(e.target.value)} className="w-full" />
                </label>
                <label>
                  Email
                  <input type="email" value={props.quickStaffEmail} onChange={(e) => props.setQuickStaffEmail(e.target.value)} className="w-full" />
                </label>
                <button type="submit" disabled={!props.canSubmitQuickStaff} className="btn btn-primary section-button-md">
                  {props.quickStaffLoading ? 'Creando...' : 'Crear staff'}
                </button>
                {!props.canSubmitQuickStaff && props.quickStaffDisabledReason ? <div style={{ color: '#666', fontSize: 12 }}>{props.quickStaffDisabledReason}</div> : null}
                <Notice tone="error" message={props.quickStaffError} onClose={() => props.setQuickStaffError('')} />
                <Notice tone="success" message={props.quickStaffSuccess} onClose={() => props.setQuickStaffSuccess('')} />
              </form>
            ) : null}

            {props.operationsView === 'quick-booking' ? (
              <form onSubmit={props.onCreateBooking} className="panel section-form" style={{ gap: 8 }}>
                <strong>Crear booking</strong>
                <label>
                  Servicio
                  <select value={props.quickBookingServiceId} onChange={(e) => props.setQuickBookingServiceId(e.target.value)} className="w-full" disabled={props.serviceLoading}>
                    <option value="">Seleccionar</option>
                    {props.serviceOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Staff
                  <select value={props.quickBookingStaffId} onChange={(e) => props.setQuickBookingStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
                    <option value="">Seleccionar</option>
                    {props.staffOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Inicio
                  <input type="datetime-local" value={props.quickBookingStartAt} onChange={(e) => props.setQuickBookingStartAt(e.target.value)} className="w-full" />
                </label>
                <label>
                  Cliente
                  <input value={props.quickBookingCustomerName} onChange={(e) => props.setQuickBookingCustomerName(e.target.value)} className="w-full" />
                </label>
                <label>
                  Email cliente
                  <input type="email" value={props.quickBookingCustomerEmail} onChange={(e) => props.setQuickBookingCustomerEmail(e.target.value)} className="w-full" />
                </label>
                <label>
                  Notas (opcional)
                  <input value={props.quickBookingNotes} onChange={(e) => props.setQuickBookingNotes(e.target.value)} className="w-full" />
                </label>
                <button type="submit" disabled={!props.canSubmitQuickBooking} className="btn btn-primary section-button-md">
                  {props.quickBookingLoading ? 'Creando...' : 'Crear booking'}
                </button>
                {!props.canSubmitQuickBooking && props.quickBookingDisabledReason ? <div style={{ color: '#666', fontSize: 12 }}>{props.quickBookingDisabledReason}</div> : null}
                <Notice tone="error" message={props.quickBookingError} onClose={() => props.setQuickBookingError('')} />
                <Notice tone="success" message={props.quickBookingSuccess} onClose={() => props.setQuickBookingSuccess('')} />
              </form>
            ) : null}

            {props.operationsView === 'quick-waitlist' ? (
              <form onSubmit={props.onJoinWaitlist} className="panel section-form" style={{ gap: 8 }}>
                <strong>Join waitlist</strong>
                <label>
                  Servicio
                  <select value={props.quickWaitlistServiceId} onChange={(e) => props.setQuickWaitlistServiceId(e.target.value)} className="w-full" disabled={props.serviceLoading}>
                    <option value="">Seleccionar</option>
                    {props.serviceOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Staff
                  <select value={props.quickWaitlistStaffId} onChange={(e) => props.setQuickWaitlistStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
                    <option value="">Seleccionar</option>
                    {props.staffOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fecha/hora preferida
                  <input type="datetime-local" value={props.quickWaitlistPreferredStartAt} onChange={(e) => props.setQuickWaitlistPreferredStartAt(e.target.value)} className="w-full" />
                </label>
                <label>
                  Cliente
                  <input value={props.quickWaitlistCustomerName} onChange={(e) => props.setQuickWaitlistCustomerName(e.target.value)} className="w-full" />
                </label>
                <label>
                  Email cliente
                  <input type="email" value={props.quickWaitlistCustomerEmail} onChange={(e) => props.setQuickWaitlistCustomerEmail(e.target.value)} className="w-full" />
                </label>
                <label>
                  Notas (opcional)
                  <input value={props.quickWaitlistNotes} onChange={(e) => props.setQuickWaitlistNotes(e.target.value)} className="w-full" />
                </label>
                <button type="submit" disabled={!props.canSubmitQuickWaitlist} className="btn btn-primary section-button-md">
                  {props.quickWaitlistLoading ? 'Agregando...' : 'Agregar waitlist'}
                </button>
                {!props.canSubmitQuickWaitlist && props.quickWaitlistDisabledReason ? <div style={{ color: '#666', fontSize: 12 }}>{props.quickWaitlistDisabledReason}</div> : null}
                <Notice tone="error" message={props.quickWaitlistError} onClose={() => props.setQuickWaitlistError('')} />
                <Notice tone="success" message={props.quickWaitlistSuccess} onClose={() => props.setQuickWaitlistSuccess('')} />
              </form>
            ) : null}
          </div>
        </section>
      ) : null}

      {isAvailabilityView ? (
        <section className="section-block" style={{ marginTop: 28 }}>
        <h2 className="section-title">Disponibilidad configurada</h2>
        <p className="section-subtitle">Lista de reglas y excepciones actuales del tenant autenticado.</p>

        <div className="section-grid section-grid-2" style={{ marginBottom: 8 }}>
          {showRulesForm ? (
            <form onSubmit={props.onCreateAvailabilityRule} className="panel section-form" style={{ gap: 8 }}>
              <strong>Crear regla disponibilidad</strong>
              <label>
                Día semana
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
              <label>
                Hora inicio
                <input type="time" value={props.quickRuleStartTime} onChange={(e) => props.setQuickRuleStartTime(e.target.value)} className="w-full" />
              </label>
              <label>
                Hora fin
                <input type="time" value={props.quickRuleEndTime} onChange={(e) => props.setQuickRuleEndTime(e.target.value)} className="w-full" />
              </label>
              <label>
                Staff
                <select value={props.quickRuleStaffId} onChange={(e) => props.setQuickRuleStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
                  <option value="">Seleccionar</option>
                  {props.staffOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={!props.canSubmitQuickRule} className="btn btn-primary section-button-lg">
                {props.quickRuleLoading ? 'Creando...' : 'Crear regla'}
              </button>
              {!props.canSubmitQuickRule && props.quickRuleDisabledReason ? <div style={{ color: '#666', fontSize: 12 }}>{props.quickRuleDisabledReason}</div> : null}
              <Notice tone="error" message={props.quickRuleError} onClose={() => props.setQuickRuleError('')} />
              <Notice tone="success" message={props.quickRuleSuccess} onClose={() => props.setQuickRuleSuccess('')} />
            </form>
          ) : null}

          {showExceptionsForm ? (
            <form onSubmit={props.onCreateAvailabilityException} className="panel section-form" style={{ gap: 8 }}>
              <strong>Crear excepción disponibilidad</strong>
              <label>
                Fecha
                <input type="date" value={props.quickExceptionDate} onChange={(e) => props.setQuickExceptionDate(e.target.value)} className="w-full" />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={props.quickExceptionFullDay} onChange={(e) => props.setQuickExceptionFullDay(e.target.checked)} />
                Bloqueo todo el día
              </label>
              <label>
                Hora inicio
                <input type="time" value={props.quickExceptionStartTime} onChange={(e) => props.setQuickExceptionStartTime(e.target.value)} className="w-full" disabled={props.quickExceptionFullDay} />
              </label>
              <label>
                Hora fin
                <input type="time" value={props.quickExceptionEndTime} onChange={(e) => props.setQuickExceptionEndTime(e.target.value)} className="w-full" disabled={props.quickExceptionFullDay} />
              </label>
              <label>
                Staff
                <select value={props.quickExceptionStaffId} onChange={(e) => props.setQuickExceptionStaffId(e.target.value)} className="w-full" disabled={props.staffLoading}>
                  <option value="">Seleccionar</option>
                  {props.staffOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nota (opcional)
                <input value={props.quickExceptionNote} onChange={(e) => props.setQuickExceptionNote(e.target.value)} className="w-full" />
              </label>
              <button type="submit" disabled={!props.canSubmitQuickException} className="btn btn-primary section-button-lg">
                {props.quickExceptionLoading ? 'Creando...' : 'Crear excepción'}
              </button>
              {!props.canSubmitQuickException && props.quickExceptionDisabledReason ? <div style={{ color: '#666', fontSize: 12 }}>{props.quickExceptionDisabledReason}</div> : null}
              <Notice tone="error" message={props.quickExceptionError} onClose={() => props.setQuickExceptionError('')} />
              <Notice tone="success" message={props.quickExceptionSuccess} onClose={() => props.setQuickExceptionSuccess('')} />
            </form>
          ) : null}
        </div>

        <div className="section-actions" style={{ marginBottom: 12 }}>
          <button
            type="button"
            disabled={props.availabilityLoading || !props.token.trim()}
            onClick={() => {
              void props.loadAvailabilityData();
            }}
            className="btn btn-ghost section-button-lg"
          >
            {props.availabilityLoading ? 'Cargando...' : 'Refresh disponibilidad'}
          </button>
        </div>

        <Notice tone="error" message={props.availabilityError} withMargin onClose={() => props.setAvailabilityError('')} />
        <Notice tone="error" message={props.availabilityActionError} withMargin onClose={() => props.setAvailabilityActionError('')} />
        <Notice tone="success" message={props.availabilityActionSuccess} withMargin onClose={() => props.setAvailabilityActionSuccess('')} />

        <div className="section-grid section-grid-2">
          {showRulesPanel ? (
          <div className="panel">
            <strong>Rules</strong>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Horario</th>
                    <th>Staff</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {props.availabilityRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{DAY_OF_WEEK_LABEL[rule.dayOfWeek] ?? String(rule.dayOfWeek)}</td>
                      <td>{rule.startTime} - {rule.endTime}</td>
                      <td>{props.staffOptions.find((entry) => entry.id === rule.staffId)?.fullName ?? rule.staffId ?? '-'}</td>
                      <td>{rule.isActive ? 'Activa' : 'Inactiva'}</td>
                      <td>
                        <div className="section-actions" style={{ gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              void props.onToggleAvailabilityRule(rule);
                            }}
                            disabled={props.availabilityActionLoadingId === `rule-toggle-${rule.id}` || props.availabilityActionLoadingId === `rule-delete-${rule.id}`}
                            className="btn btn-ghost"
                          >
                            {props.availabilityActionLoadingId === `rule-toggle-${rule.id}` ? 'Guardando...' : rule.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void props.onDeleteAvailabilityRule(rule.id);
                            }}
                            disabled={props.availabilityActionLoadingId === `rule-delete-${rule.id}` || props.availabilityActionLoadingId === `rule-toggle-${rule.id}`}
                            className="btn btn-ghost"
                          >
                            {props.availabilityActionLoadingId === `rule-delete-${rule.id}` ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!props.availabilityRules.length ? (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        Sin reglas cargadas.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          ) : null}

          {showExceptionsPanel ? (
          <div className="panel">
            <strong>Exceptions</strong>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Horario</th>
                    <th>Staff</th>
                    <th>Tipo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {props.availabilityExceptions.map((exception) => (
                    <tr key={exception.id}>
                      <td>{new Date(exception.date).toLocaleDateString()}</td>
                      <td>{exception.startTime && exception.endTime ? `${exception.startTime} - ${exception.endTime}` : 'Todo el día'}</td>
                      <td>{props.staffOptions.find((entry) => entry.id === exception.staffId)?.fullName ?? exception.staffId ?? '-'}</td>
                      <td>{(props.availabilityExceptionUnavailableDrafts[exception.id] ?? exception.isUnavailable) ? 'No disponible' : 'Disponible'}</td>
                      <td>
                        <div className="section-form" style={{ gap: 6 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={props.availabilityExceptionUnavailableDrafts[exception.id] ?? exception.isUnavailable}
                              onChange={(e) =>
                                props.setAvailabilityExceptionUnavailableDrafts((current) => ({
                                  ...current,
                                  [exception.id]: e.target.checked
                                }))
                              }
                            />
                            No disponible
                          </label>
                          <input
                            value={props.availabilityExceptionNoteDrafts[exception.id] ?? exception.note ?? ''}
                            onChange={(e) =>
                              props.setAvailabilityExceptionNoteDrafts((current) => ({
                                ...current,
                                [exception.id]: e.target.value
                              }))
                            }
                            placeholder="Nota"
                              className="w-full"
                          />
                            <div className="section-actions" style={{ gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                void props.onSaveAvailabilityException(exception.id);
                              }}
                              disabled={props.availabilityActionLoadingId === `exception-save-${exception.id}` || props.availabilityActionLoadingId === `exception-delete-${exception.id}`}
                              className="btn btn-primary"
                            >
                              {props.availabilityActionLoadingId === `exception-save-${exception.id}` ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void props.onDeleteAvailabilityException(exception.id);
                              }}
                              disabled={props.availabilityActionLoadingId === `exception-delete-${exception.id}` || props.availabilityActionLoadingId === `exception-save-${exception.id}`}
                              className="btn btn-ghost"
                            >
                              {props.availabilityActionLoadingId === `exception-delete-${exception.id}` ? 'Eliminando...' : 'Eliminar'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!props.availabilityExceptions.length ? (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        Sin excepciones cargadas.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          ) : null}
        </div>
      </section>
      ) : null}
    </>
  );
}
