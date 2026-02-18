'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

type StaffMember = {
  id: string;
  fullName: string;
};

type ServiceItem = {
  id: string;
  name: string;
};

type DashboardResponse = {
  range: 'day' | 'week' | 'month';
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalAppointments: number;
    totalScheduledMinutes: number;
    byStatus: Record<string, number>;
    byStaff: Record<string, number>;
  };
  bookings: Array<{
    id: string;
    customerName: string;
    customerEmail: string;
    status: string;
    startAt: string;
    endAt: string;
    service: { name: string };
    staff: { fullName: string };
  }>;
};

type AuditLogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorUserId: string | null;
  createdAt: string;
};

type AuditLogsResponse = {
  items: AuditLogEntry[];
  nextCursor: string | null;
};

const TOKEN_KEY = 'apoint.dashboard.token';
const API_URL_KEY = 'apoint.dashboard.apiUrl';
const today = new Date().toISOString().slice(0, 10);
const STATUS_OPTIONS = ['pending', 'confirmed', 'cancelled', 'rescheduled', 'no_show', 'completed'] as const;

const dashboardFilterSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  range: z.enum(['day', 'week', 'month']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida. Usa formato YYYY-MM-DD.'),
  staffId: z.string().optional(),
  status: z.union([z.literal(''), z.enum(STATUS_OPTIONS)]),
  token: z.string().min(1, 'Token de sesión inválido.')
});

const auditFilterSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  action: z.string().optional(),
  actorUserId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(200)
});

const quickCreateServiceSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  name: z.string().trim().min(1, 'Nombre de servicio requerido.'),
  durationMinutes: z.coerce.number().int().min(5, 'Duración mínima: 5 minutos.'),
  price: z.coerce.number().min(0, 'Precio inválido.')
});

const quickCreateStaffSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  fullName: z.string().trim().min(1, 'Nombre de staff requerido.'),
  email: z.string().trim().email('Email de staff inválido.')
});

const quickCreateBookingSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  serviceId: z.string().trim().min(1, 'Selecciona un servicio.'),
  staffId: z.string().trim().min(1, 'Selecciona un staff.'),
  startAt: z.string().trim().min(1, 'Fecha/hora requerida.'),
  customerName: z.string().trim().min(1, 'Nombre de cliente requerido.'),
  customerEmail: z.string().trim().email('Email de cliente inválido.'),
  notes: z.string().optional()
});

const quickCreateAvailabilityRuleSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inicio inválida. Usa HH:mm.'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora fin inválida. Usa HH:mm.'),
  staffId: z.string().trim().min(1, 'Selecciona staff para la regla.')
});

const quickCreateAvailabilityExceptionSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida. Usa YYYY-MM-DD.'),
  fullDay: z.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  staffId: z.string().trim().min(1, 'Selecciona staff para la excepción.'),
  note: z.string().optional()
});

const quickCancelBookingSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  bookingId: z.string().trim().min(1, 'Booking inválido.')
});

const quickRescheduleBookingSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  bookingId: z.string().trim().min(1, 'Booking inválido.'),
  startAt: z.string().trim().min(1, 'Fecha/hora requerida para reprogramar.')
});

function toDateTimeLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState('http://localhost:3001');
  const [token, setToken] = useState('');
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const [date, setDate] = useState(today);
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState('');
  const [staffOptions, setStaffOptions] = useState<StaffMember[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceItem[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [serviceError, setServiceError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [auditAction, setAuditAction] = useState('');
  const [auditActorUserId, setAuditActorUserId] = useState('');
  const [auditFrom, setAuditFrom] = useState(today);
  const [auditTo, setAuditTo] = useState(today);
  const [auditLimit, setAuditLimit] = useState('20');
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [quickServiceName, setQuickServiceName] = useState('');
  const [quickServiceDuration, setQuickServiceDuration] = useState('30');
  const [quickServicePrice, setQuickServicePrice] = useState('100');
  const [quickServiceLoading, setQuickServiceLoading] = useState(false);
  const [quickServiceError, setQuickServiceError] = useState('');
  const [quickServiceSuccess, setQuickServiceSuccess] = useState('');
  const [quickStaffName, setQuickStaffName] = useState('');
  const [quickStaffEmail, setQuickStaffEmail] = useState('');
  const [quickStaffLoading, setQuickStaffLoading] = useState(false);
  const [quickStaffError, setQuickStaffError] = useState('');
  const [quickStaffSuccess, setQuickStaffSuccess] = useState('');
  const [quickBookingServiceId, setQuickBookingServiceId] = useState('');
  const [quickBookingStaffId, setQuickBookingStaffId] = useState('');
  const [quickBookingStartAt, setQuickBookingStartAt] = useState('');
  const [quickBookingCustomerName, setQuickBookingCustomerName] = useState('');
  const [quickBookingCustomerEmail, setQuickBookingCustomerEmail] = useState('');
  const [quickBookingNotes, setQuickBookingNotes] = useState('');
  const [quickBookingLoading, setQuickBookingLoading] = useState(false);
  const [quickBookingError, setQuickBookingError] = useState('');
  const [quickBookingSuccess, setQuickBookingSuccess] = useState('');
  const [quickRuleDayOfWeek, setQuickRuleDayOfWeek] = useState('1');
  const [quickRuleStartTime, setQuickRuleStartTime] = useState('09:00');
  const [quickRuleEndTime, setQuickRuleEndTime] = useState('18:00');
  const [quickRuleStaffId, setQuickRuleStaffId] = useState('');
  const [quickRuleLoading, setQuickRuleLoading] = useState(false);
  const [quickRuleError, setQuickRuleError] = useState('');
  const [quickRuleSuccess, setQuickRuleSuccess] = useState('');
  const [quickExceptionDate, setQuickExceptionDate] = useState(today);
  const [quickExceptionFullDay, setQuickExceptionFullDay] = useState(true);
  const [quickExceptionStartTime, setQuickExceptionStartTime] = useState('09:00');
  const [quickExceptionEndTime, setQuickExceptionEndTime] = useState('18:00');
  const [quickExceptionStaffId, setQuickExceptionStaffId] = useState('');
  const [quickExceptionNote, setQuickExceptionNote] = useState('');
  const [quickExceptionLoading, setQuickExceptionLoading] = useState(false);
  const [quickExceptionError, setQuickExceptionError] = useState('');
  const [quickExceptionSuccess, setQuickExceptionSuccess] = useState('');
  const [bookingActionLoadingId, setBookingActionLoadingId] = useState('');
  const [bookingActionError, setBookingActionError] = useState('');
  const [bookingActionSuccess, setBookingActionSuccess] = useState('');
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, string>>({});

  const summaryStatus = useMemo(() => {
    if (!data) return [] as Array<[string, number]>;
    return Object.entries(data.summary.byStatus);
  }, [data]);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedApiUrl = localStorage.getItem(API_URL_KEY);

    if (!storedToken) {
      router.replace('/login');
      return;
    }

    setToken(storedToken);
    if (storedApiUrl) {
      setApiUrl(storedApiUrl);
    }
  }, [router]);

  useEffect(() => {
    const parsedApiUrl = z.string().url().safeParse(apiUrl.trim());
    if (parsedApiUrl.success) {
      localStorage.setItem(API_URL_KEY, parsedApiUrl.data);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (!token.trim()) {
      return;
    }

    let cancelled = false;

    async function loadReferenceData() {
      setStaffLoading(true);
      setServiceLoading(true);
      setStaffError('');
      setServiceError('');

      try {
        const parsedApiUrl = z.string().url().safeParse(apiUrl.trim());
        if (!parsedApiUrl.success) {
          setStaffError('API URL inválida.');
          setServiceError('API URL inválida.');
          return;
        }

        const [staffResponse, servicesResponse] = await Promise.all([
          fetch(new URL('/staff', parsedApiUrl.data).toString(), {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }),
          fetch(new URL('/services', parsedApiUrl.data).toString(), {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
        ]);

        if (!staffResponse.ok) {
          const text = await staffResponse.text();
          throw new Error(text || `Error ${staffResponse.status}`);
        }

        if (!servicesResponse.ok) {
          const text = await servicesResponse.text();
          throw new Error(text || `Error ${servicesResponse.status}`);
        }

        const staffPayload = (await staffResponse.json()) as StaffMember[];
        const servicesPayload = (await servicesResponse.json()) as ServiceItem[];
        if (cancelled) {
          return;
        }

        setStaffOptions(staffPayload);
        setServiceOptions(servicesPayload);

        if (staffPayload.length && !staffPayload.some((entry) => entry.id === staffId)) {
          setStaffId('');
        }
        if (staffPayload.length && !staffPayload.some((entry) => entry.id === quickBookingStaffId)) {
          setQuickBookingStaffId(staffPayload[0]?.id ?? '');
        }
        if (staffPayload.length && !staffPayload.some((entry) => entry.id === quickRuleStaffId)) {
          setQuickRuleStaffId(staffPayload[0]?.id ?? '');
        }
        if (staffPayload.length && !staffPayload.some((entry) => entry.id === quickExceptionStaffId)) {
          setQuickExceptionStaffId(staffPayload[0]?.id ?? '');
        }

        if (servicesPayload.length && !servicesPayload.some((entry) => entry.id === quickBookingServiceId)) {
          setQuickBookingServiceId(servicesPayload[0]?.id ?? '');
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar staff';
        setStaffError(message);
        setServiceError(message);
      } finally {
        if (!cancelled) {
          setStaffLoading(false);
          setServiceLoading(false);
        }
      }
    }

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, token]);

  function onLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setData(null);
    setAuditLogs([]);
    setAuditCursor(null);
    router.replace('/login');
  }

  async function loadAuditLogs(nextCursor?: string) {
    setAuditError('');

    const parsedLimit = Number(auditLimit);
    const parsed = auditFilterSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      action: auditAction.trim() || undefined,
      actorUserId: auditActorUserId.trim() || undefined,
      from: auditFrom || undefined,
      to: auditTo || undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : NaN
    });

    if (!parsed.success) {
      setAuditError(parsed.error.issues[0]?.message ?? 'Filtros de auditoría inválidos.');
      return;
    }

    setAuditLoading(true);

    try {
      const url = new URL('/audit/logs', parsed.data.apiUrl);
      if (parsed.data.action) {
        url.searchParams.set('action', parsed.data.action);
      }
      if (parsed.data.actorUserId) {
        url.searchParams.set('actorUserId', parsed.data.actorUserId);
      }
      if (parsed.data.from) {
        url.searchParams.set('from', `${parsed.data.from}T00:00:00.000Z`);
      }
      if (parsed.data.to) {
        url.searchParams.set('to', `${parsed.data.to}T23:59:59.999Z`);
      }
      url.searchParams.set('limit', String(parsed.data.limit));
      if (nextCursor) {
        url.searchParams.set('cursor', nextCursor);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${parsed.data.token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as AuditLogsResponse;
      setAuditLogs(payload.items ?? []);
      setAuditCursor(payload.nextCursor ?? null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo cargar auditoría';
      setAuditError(message);
      setAuditLogs([]);
      setAuditCursor(null);
    } finally {
      setAuditLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const parsed = dashboardFilterSchema.safeParse({
      apiUrl: apiUrl.trim(),
      range,
      date,
      staffId: staffId.trim() || undefined,
      status,
      token: token.trim()
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Filtros inválidos.');
      setData(null);
      return;
    }

    setLoading(true);

    try {
      const url = new URL('/dashboard/appointments', parsed.data.apiUrl);
      url.searchParams.set('range', parsed.data.range);
      url.searchParams.set('date', parsed.data.date);
      if (parsed.data.staffId) {
        url.searchParams.set('staffId', parsed.data.staffId);
      }
      if (parsed.data.status) {
        url.searchParams.set('status', parsed.data.status);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${parsed.data.token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as DashboardResponse;
      setData(payload);
      setRescheduleDrafts((current) => {
        const next = { ...current };
        for (const booking of payload.bookings) {
          if (!next[booking.id]) {
            next[booking.id] = toDateTimeLocalInput(booking.startAt);
          }
        }
        return next;
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Error inesperado';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function onCreateService(event: FormEvent) {
    event.preventDefault();
    setQuickServiceError('');
    setQuickServiceSuccess('');

    const parsed = quickCreateServiceSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      name: quickServiceName,
      durationMinutes: quickServiceDuration,
      price: quickServicePrice
    });

    if (!parsed.success) {
      setQuickServiceError(parsed.error.issues[0]?.message ?? 'Datos de servicio inválidos.');
      return;
    }

    setQuickServiceLoading(true);

    try {
      const response = await fetch(new URL('/services', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          name: parsed.data.name,
          durationMinutes: parsed.data.durationMinutes,
          price: parsed.data.price
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setQuickServiceSuccess('Servicio creado correctamente.');
      setQuickServiceName('');

      const created = (await response.json()) as ServiceItem;
      if (created?.id && created?.name) {
        setServiceOptions((current) => {
          if (current.some((entry) => entry.id === created.id)) {
            return current;
          }
          return [...current, created];
        });
        if (!quickBookingServiceId) {
          setQuickBookingServiceId(created.id);
        }
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo crear servicio';
      setQuickServiceError(message);
    } finally {
      setQuickServiceLoading(false);
    }
  }

  async function onCreateStaff(event: FormEvent) {
    event.preventDefault();
    setQuickStaffError('');
    setQuickStaffSuccess('');

    const parsed = quickCreateStaffSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      fullName: quickStaffName,
      email: quickStaffEmail
    });

    if (!parsed.success) {
      setQuickStaffError(parsed.error.issues[0]?.message ?? 'Datos de staff inválidos.');
      return;
    }

    setQuickStaffLoading(true);

    try {
      const response = await fetch(new URL('/staff', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          fullName: parsed.data.fullName,
          email: parsed.data.email
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as StaffMember;
      if (payload?.id && payload?.fullName) {
        setStaffOptions((current) => {
          if (current.some((entry) => entry.id === payload.id)) {
            return current;
          }
          return [...current, payload];
        });
      }

      setQuickStaffSuccess('Staff creado correctamente.');
      setQuickStaffName('');
      setQuickStaffEmail('');
      if (!quickBookingStaffId && payload?.id) {
        setQuickBookingStaffId(payload.id);
      }
      if (!quickRuleStaffId && payload?.id) {
        setQuickRuleStaffId(payload.id);
      }
      if (!quickExceptionStaffId && payload?.id) {
        setQuickExceptionStaffId(payload.id);
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo crear staff';
      setQuickStaffError(message);
    } finally {
      setQuickStaffLoading(false);
    }
  }

  async function onCreateBooking(event: FormEvent) {
    event.preventDefault();
    setQuickBookingError('');
    setQuickBookingSuccess('');

    const parsed = quickCreateBookingSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      serviceId: quickBookingServiceId,
      staffId: quickBookingStaffId,
      startAt: quickBookingStartAt,
      customerName: quickBookingCustomerName,
      customerEmail: quickBookingCustomerEmail,
      notes: quickBookingNotes.trim() || undefined
    });

    if (!parsed.success) {
      setQuickBookingError(parsed.error.issues[0]?.message ?? 'Datos de booking inválidos.');
      return;
    }

    const startAtDate = new Date(parsed.data.startAt);
    if (Number.isNaN(startAtDate.getTime())) {
      setQuickBookingError('Fecha/hora inválida para la reserva.');
      return;
    }

    setQuickBookingLoading(true);

    try {
      const response = await fetch(new URL('/bookings', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          serviceId: parsed.data.serviceId,
          staffId: parsed.data.staffId,
          startAt: startAtDate.toISOString(),
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          notes: parsed.data.notes
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setQuickBookingSuccess('Reserva creada correctamente.');
      setQuickBookingStartAt('');
      setQuickBookingCustomerName('');
      setQuickBookingCustomerEmail('');
      setQuickBookingNotes('');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo crear reserva';
      setQuickBookingError(message);
    } finally {
      setQuickBookingLoading(false);
    }
  }

  async function onCreateAvailabilityRule(event: FormEvent) {
    event.preventDefault();
    setQuickRuleError('');
    setQuickRuleSuccess('');

    const parsed = quickCreateAvailabilityRuleSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      dayOfWeek: quickRuleDayOfWeek,
      startTime: quickRuleStartTime,
      endTime: quickRuleEndTime,
      staffId: quickRuleStaffId
    });

    if (!parsed.success) {
      setQuickRuleError(parsed.error.issues[0]?.message ?? 'Datos de regla inválidos.');
      return;
    }

    if (parsed.data.startTime >= parsed.data.endTime) {
      setQuickRuleError('La hora de inicio debe ser menor a la hora de fin.');
      return;
    }

    setQuickRuleLoading(true);

    try {
      const response = await fetch(new URL('/availability/rules', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          dayOfWeek: parsed.data.dayOfWeek,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          staffId: parsed.data.staffId,
          isActive: true
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setQuickRuleSuccess('Regla de disponibilidad creada correctamente.');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo crear regla de disponibilidad';
      setQuickRuleError(message);
    } finally {
      setQuickRuleLoading(false);
    }
  }

  async function onCreateAvailabilityException(event: FormEvent) {
    event.preventDefault();
    setQuickExceptionError('');
    setQuickExceptionSuccess('');

    const parsed = quickCreateAvailabilityExceptionSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      date: quickExceptionDate,
      fullDay: quickExceptionFullDay,
      startTime: quickExceptionStartTime,
      endTime: quickExceptionEndTime,
      staffId: quickExceptionStaffId,
      note: quickExceptionNote.trim() || undefined
    });

    if (!parsed.success) {
      setQuickExceptionError(parsed.error.issues[0]?.message ?? 'Datos de excepción inválidos.');
      return;
    }

    if (!parsed.data.fullDay) {
      if (!parsed.data.startTime || !parsed.data.endTime) {
        setQuickExceptionError('Debes enviar hora inicio y fin para excepción parcial.');
        return;
      }
      if (parsed.data.startTime >= parsed.data.endTime) {
        setQuickExceptionError('La hora de inicio debe ser menor a la hora de fin.');
        return;
      }
    }

    setQuickExceptionLoading(true);

    try {
      const response = await fetch(new URL('/availability/exceptions', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          date: `${parsed.data.date}T00:00:00.000Z`,
          startTime: parsed.data.fullDay ? undefined : parsed.data.startTime,
          endTime: parsed.data.fullDay ? undefined : parsed.data.endTime,
          staffId: parsed.data.staffId,
          isUnavailable: true,
          note: parsed.data.note
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setQuickExceptionSuccess('Excepción de disponibilidad creada correctamente.');
      setQuickExceptionNote('');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo crear excepción de disponibilidad';
      setQuickExceptionError(message);
    } finally {
      setQuickExceptionLoading(false);
    }
  }

  async function onCancelBooking(bookingId: string) {
    setBookingActionError('');
    setBookingActionSuccess('');

    const parsed = quickCancelBookingSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      bookingId
    });

    if (!parsed.success) {
      setBookingActionError(parsed.error.issues[0]?.message ?? 'No se puede cancelar booking.');
      return;
    }

    setBookingActionLoadingId(bookingId);

    try {
      const response = await fetch(new URL(`/bookings/${parsed.data.bookingId}/cancel`, parsed.data.apiUrl).toString(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({ reason: 'Cancelado desde dashboard' })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          bookings: current.bookings.map((entry) =>
            entry.id === bookingId
              ? {
                  ...entry,
                  status: 'cancelled'
                }
              : entry
          )
        };
      });
      setBookingActionSuccess('Booking cancelado correctamente.');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo cancelar booking';
      setBookingActionError(message);
    } finally {
      setBookingActionLoadingId('');
    }
  }

  async function onRescheduleBooking(bookingId: string) {
    setBookingActionError('');
    setBookingActionSuccess('');

    const parsed = quickRescheduleBookingSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      bookingId,
      startAt: rescheduleDrafts[bookingId] ?? ''
    });

    if (!parsed.success) {
      setBookingActionError(parsed.error.issues[0]?.message ?? 'No se puede reprogramar booking.');
      return;
    }

    const startAtDate = new Date(parsed.data.startAt);
    if (Number.isNaN(startAtDate.getTime())) {
      setBookingActionError('Fecha/hora inválida para reprogramación.');
      return;
    }

    setBookingActionLoadingId(bookingId);

    try {
      const response = await fetch(new URL(`/bookings/${parsed.data.bookingId}/reschedule`, parsed.data.apiUrl).toString(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          startAt: startAtDate.toISOString()
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const updated = (await response.json()) as { id: string; startAt: string; endAt: string; status: string };

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          bookings: current.bookings.map((entry) =>
            entry.id === bookingId
              ? {
                  ...entry,
                  startAt: updated.startAt,
                  endAt: updated.endAt,
                  status: updated.status
                }
              : entry
          )
        };
      });
      setRescheduleDrafts((current) => ({
        ...current,
        [bookingId]: toDateTimeLocalInput(updated.startAt)
      }));
      setBookingActionSuccess('Booking reprogramado correctamente.');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo reprogramar booking';
      setBookingActionError(message);
    } finally {
      setBookingActionLoadingId('');
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>Apoint Dashboard (MVP)</h1>
      <p style={{ marginTop: 0, color: '#555' }}>Calendario operativo día/semana/mes consumiendo API real.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={onLogout} style={{ padding: '8px 12px' }}>
          Logout
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        <label>
          API URL
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <label>
            Rango
            <select value={range} onChange={(e) => setRange(e.target.value as 'day' | 'week' | 'month')} style={{ width: '100%' }}>
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </label>
          <label>
            Fecha base
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Staff (opcional)
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ width: '100%' }} disabled={staffLoading}>
              <option value="">Todos</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado (opcional)
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        </div>
        {staffError ? <div style={{ background: '#fff4e5', color: '#8a5300', padding: 10, borderRadius: 6 }}>{staffError}</div> : null}
        {serviceError ? <div style={{ background: '#fff4e5', color: '#8a5300', padding: 10, borderRadius: 6 }}>{serviceError}</div> : null}
        <button type="submit" disabled={loading || !token.trim()} style={{ width: 220, padding: '8px 12px' }}>
          {loading ? 'Consultando...' : 'Cargar calendario'}
        </button>
      </form>

      {error ? (
        <div style={{ background: '#fee', color: '#900', padding: 12, borderRadius: 6, marginBottom: 16 }}>{error}</div>
      ) : null}

      {bookingActionError ? (
        <div style={{ background: '#fee', color: '#900', padding: 12, borderRadius: 6, marginBottom: 16 }}>{bookingActionError}</div>
      ) : null}
      {bookingActionSuccess ? (
        <div style={{ background: '#ecfdf3', color: '#166534', padding: 12, borderRadius: 6, marginBottom: 16 }}>{bookingActionSuccess}</div>
      ) : null}

      {data ? (
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Total citas</strong>
              <div>{data.summary.totalAppointments}</div>
            </article>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Minutos agendados</strong>
              <div>{data.summary.totalScheduledMinutes}</div>
            </article>
            <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>Período</strong>
              <div>{new Date(data.period.start).toLocaleString()} → {new Date(data.period.end).toLocaleString()}</div>
            </article>
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Estados:</strong>{' '}
            {summaryStatus.length ? summaryStatus.map(([key, value]) => `${key}: ${value}`).join(' | ') : 'Sin datos'}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Inicio</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Fin</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Cliente</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Servicio</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Staff</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Estado</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{new Date(booking.startAt).toLocaleString()}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{new Date(booking.endAt).toLocaleString()}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.customerName}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.service.name}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.staff.fullName}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{booking.status}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            void onCancelBooking(booking.id);
                          }}
                          disabled={bookingActionLoadingId === booking.id || booking.status === 'cancelled'}
                          style={{ width: 120, padding: '6px 8px' }}
                        >
                          {bookingActionLoadingId === booking.id ? 'Procesando...' : 'Cancelar'}
                        </button>
                        <input
                          type="datetime-local"
                          value={rescheduleDrafts[booking.id] ?? toDateTimeLocalInput(booking.startAt)}
                          onChange={(e) =>
                            setRescheduleDrafts((current) => ({
                              ...current,
                              [booking.id]: e.target.value
                            }))
                          }
                          style={{ width: '100%' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void onRescheduleBooking(booking.id);
                          }}
                          disabled={bookingActionLoadingId === booking.id || booking.status === 'cancelled'}
                          style={{ width: 120, padding: '6px 8px' }}
                        >
                          {bookingActionLoadingId === booking.id ? 'Procesando...' : 'Reprogramar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: 28 }}>
        <h2 style={{ marginBottom: 8 }}>Acciones rápidas (MVP)</h2>
        <p style={{ marginTop: 0, color: '#555' }}>Alta rápida de servicios, staff, reservas, reglas y excepciones de disponibilidad.</p>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 8 }}>
          <form onSubmit={onCreateService} style={{ display: 'grid', gap: 8, border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <strong>Crear servicio</strong>
            <label>
              Nombre
              <input value={quickServiceName} onChange={(e) => setQuickServiceName(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Duración (min)
              <input type="number" min={5} value={quickServiceDuration} onChange={(e) => setQuickServiceDuration(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Precio
              <input type="number" min={0} step="0.01" value={quickServicePrice} onChange={(e) => setQuickServicePrice(e.target.value)} style={{ width: '100%' }} />
            </label>
            <button type="submit" disabled={quickServiceLoading || !token.trim()} style={{ width: 180, padding: '8px 12px' }}>
              {quickServiceLoading ? 'Creando...' : 'Crear servicio'}
            </button>
            {quickServiceError ? <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{quickServiceError}</div> : null}
            {quickServiceSuccess ? <div style={{ background: '#ecfdf3', color: '#166534', padding: 10, borderRadius: 6 }}>{quickServiceSuccess}</div> : null}
          </form>

          <form onSubmit={onCreateStaff} style={{ display: 'grid', gap: 8, border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <strong>Crear staff</strong>
            <label>
              Nombre completo
              <input value={quickStaffName} onChange={(e) => setQuickStaffName(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Email
              <input type="email" value={quickStaffEmail} onChange={(e) => setQuickStaffEmail(e.target.value)} style={{ width: '100%' }} />
            </label>
            <button type="submit" disabled={quickStaffLoading || !token.trim()} style={{ width: 180, padding: '8px 12px' }}>
              {quickStaffLoading ? 'Creando...' : 'Crear staff'}
            </button>
            {quickStaffError ? <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{quickStaffError}</div> : null}
            {quickStaffSuccess ? <div style={{ background: '#ecfdf3', color: '#166534', padding: 10, borderRadius: 6 }}>{quickStaffSuccess}</div> : null}
          </form>

          <form onSubmit={onCreateBooking} style={{ display: 'grid', gap: 8, border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <strong>Crear booking</strong>
            <label>
              Servicio
              <select value={quickBookingServiceId} onChange={(e) => setQuickBookingServiceId(e.target.value)} style={{ width: '100%' }} disabled={serviceLoading}>
                <option value="">Seleccionar</option>
                {serviceOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Staff
              <select value={quickBookingStaffId} onChange={(e) => setQuickBookingStaffId(e.target.value)} style={{ width: '100%' }} disabled={staffLoading}>
                <option value="">Seleccionar</option>
                {staffOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Inicio
              <input type="datetime-local" value={quickBookingStartAt} onChange={(e) => setQuickBookingStartAt(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Cliente
              <input value={quickBookingCustomerName} onChange={(e) => setQuickBookingCustomerName(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Email cliente
              <input type="email" value={quickBookingCustomerEmail} onChange={(e) => setQuickBookingCustomerEmail(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Notas (opcional)
              <input value={quickBookingNotes} onChange={(e) => setQuickBookingNotes(e.target.value)} style={{ width: '100%' }} />
            </label>
            <button type="submit" disabled={quickBookingLoading || !token.trim()} style={{ width: 180, padding: '8px 12px' }}>
              {quickBookingLoading ? 'Creando...' : 'Crear booking'}
            </button>
            {quickBookingError ? <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{quickBookingError}</div> : null}
            {quickBookingSuccess ? <div style={{ background: '#ecfdf3', color: '#166534', padding: 10, borderRadius: 6 }}>{quickBookingSuccess}</div> : null}
          </form>

          <form onSubmit={onCreateAvailabilityRule} style={{ display: 'grid', gap: 8, border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <strong>Crear regla disponibilidad</strong>
            <label>
              Día semana
              <select value={quickRuleDayOfWeek} onChange={(e) => setQuickRuleDayOfWeek(e.target.value)} style={{ width: '100%' }}>
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
              <input type="time" value={quickRuleStartTime} onChange={(e) => setQuickRuleStartTime(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Hora fin
              <input type="time" value={quickRuleEndTime} onChange={(e) => setQuickRuleEndTime(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Staff
              <select value={quickRuleStaffId} onChange={(e) => setQuickRuleStaffId(e.target.value)} style={{ width: '100%' }} disabled={staffLoading}>
                <option value="">Seleccionar</option>
                {staffOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.fullName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={quickRuleLoading || !token.trim()} style={{ width: 220, padding: '8px 12px' }}>
              {quickRuleLoading ? 'Creando...' : 'Crear regla'}
            </button>
            {quickRuleError ? <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{quickRuleError}</div> : null}
            {quickRuleSuccess ? <div style={{ background: '#ecfdf3', color: '#166534', padding: 10, borderRadius: 6 }}>{quickRuleSuccess}</div> : null}
          </form>

          <form onSubmit={onCreateAvailabilityException} style={{ display: 'grid', gap: 8, border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <strong>Crear excepción disponibilidad</strong>
            <label>
              Fecha
              <input type="date" value={quickExceptionDate} onChange={(e) => setQuickExceptionDate(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={quickExceptionFullDay} onChange={(e) => setQuickExceptionFullDay(e.target.checked)} />
              Bloqueo todo el día
            </label>
            <label>
              Hora inicio
              <input type="time" value={quickExceptionStartTime} onChange={(e) => setQuickExceptionStartTime(e.target.value)} style={{ width: '100%' }} disabled={quickExceptionFullDay} />
            </label>
            <label>
              Hora fin
              <input type="time" value={quickExceptionEndTime} onChange={(e) => setQuickExceptionEndTime(e.target.value)} style={{ width: '100%' }} disabled={quickExceptionFullDay} />
            </label>
            <label>
              Staff
              <select value={quickExceptionStaffId} onChange={(e) => setQuickExceptionStaffId(e.target.value)} style={{ width: '100%' }} disabled={staffLoading}>
                <option value="">Seleccionar</option>
                {staffOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nota (opcional)
              <input value={quickExceptionNote} onChange={(e) => setQuickExceptionNote(e.target.value)} style={{ width: '100%' }} />
            </label>
            <button type="submit" disabled={quickExceptionLoading || !token.trim()} style={{ width: 240, padding: '8px 12px' }}>
              {quickExceptionLoading ? 'Creando...' : 'Crear excepción'}
            </button>
            {quickExceptionError ? <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6 }}>{quickExceptionError}</div> : null}
            {quickExceptionSuccess ? <div style={{ background: '#ecfdf3', color: '#166534', padding: 10, borderRadius: 6 }}>{quickExceptionSuccess}</div> : null}
          </form>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ marginBottom: 8 }}>Auditoría (MVP)</h2>
        <p style={{ marginTop: 0, color: '#555' }}>Consulta acciones sensibles del tenant autenticado.</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void loadAuditLogs();
          }}
          style={{ display: 'grid', gap: 12, marginBottom: 14 }}
        >
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
            <label>
              Acción (opcional)
              <input value={auditAction} onChange={(e) => setAuditAction(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Actor User ID (opcional)
              <input value={auditActorUserId} onChange={(e) => setAuditActorUserId(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Desde
              <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Hasta
              <input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Límite
              <input type="number" min={1} max={200} value={auditLimit} onChange={(e) => setAuditLimit(e.target.value)} style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={auditLoading || !token.trim()} style={{ width: 180, padding: '8px 12px' }}>
              {auditLoading ? 'Cargando...' : 'Cargar auditoría'}
            </button>
            <button
              type="button"
              disabled={auditLoading || !auditCursor}
              onClick={() => {
                if (auditCursor) {
                  void loadAuditLogs(auditCursor);
                }
              }}
              style={{ width: 180, padding: '8px 12px' }}
            >
              Siguiente página
            </button>
          </div>
        </form>

        {auditError ? (
          <div style={{ background: '#fee', color: '#900', padding: 12, borderRadius: 6, marginBottom: 12 }}>{auditError}</div>
        ) : null}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Fecha</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Acción</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Entidad</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Entity ID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actor User ID</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{entry.action}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{entry.entity}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{entry.entityId ?? '-'}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{entry.actorUserId ?? '-'}</td>
                </tr>
              ))}
              {!auditLogs.length ? (
                <tr>
                  <td colSpan={5} style={{ padding: 10, color: '#666' }}>
                    Sin registros para los filtros actuales.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
