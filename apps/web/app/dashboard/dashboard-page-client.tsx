'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, ChevronRight, ClipboardList, CreditCard, LayoutDashboard, LogOut, Settings, UserCircle2, Wrench } from 'lucide-react';
import { OverviewSection } from './components/overview-section';
import { PaymentsSection } from './components/payments-section';
import { OperationsSection } from './components/operations-section';
import { SettingsSection } from './components/settings-section';
import { AuditSection } from './components/audit-section';
import { useDashboardBoot } from './hooks/use-dashboard-boot';
import { useAutoDismissSuccess, looksLikeEmail, toDateTimeLocalInput } from './dashboard-utils';
import type {
  StaffMember,
  ServiceItem,
  AvailabilityRuleItem,
  AvailabilityExceptionItem,
  DashboardResponse,
  DashboardReportsResponse,
  AuditLogEntry,
  AuditLogsResponse,
  TenantSettingsResponse,
  PaymentRecord,
  SaleNoteResponse
} from './dashboard-types';
import {
  STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  DAY_OF_WEEK_LABEL,
  dashboardFilterSchema,
  auditFilterSchema,
  tenantSettingsSchema,
  quickCreateServiceSchema,
  quickCreateStaffSchema,
  quickCreateBookingSchema,
  quickCreateAvailabilityRuleSchema,
  quickCreateAvailabilityExceptionSchema,
  quickCancelBookingSchema,
  quickRescheduleBookingSchema,
  quickJoinWaitlistSchema,
  quickCreatePaymentSchema,
  quickCreateStripeCheckoutSchema,
  quickConfirmStripeSchema,
  paymentsQuerySchema,
  availabilityListSchema
} from './dashboard-schemas';

const TOKEN_KEY = 'apoint.dashboard.token';
const API_URL_KEY = 'apoint.dashboard.apiUrl';
const today = new Date().toISOString().slice(0, 10);

type OperationsView =
  | 'quick-service'
  | 'quick-staff'
  | 'quick-booking'
  | 'quick-waitlist'
  | 'availability-rules'
  | 'availability-exceptions'
  | 'availability-overview';

export default function DashboardPage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState('http://localhost:3001');
  const [token, setToken] = useState('');
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const [activeSection, setActiveSection] = useState<'overview' | 'payments' | 'operations' | 'settings' | 'audit'>('overview');
  const [operationsOpen, setOperationsOpen] = useState(true);
  const [operationsQuickOpen, setOperationsQuickOpen] = useState(true);
  const [operationsAvailabilityOpen, setOperationsAvailabilityOpen] = useState(true);
  const [operationsView, setOperationsView] = useState<OperationsView>('quick-service');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
  const [reports, setReports] = useState<DashboardReportsResponse | null>(null);
  const [reportsError, setReportsError] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditActorUserId, setAuditActorUserId] = useState('');
  const [auditFrom, setAuditFrom] = useState(today);
  const [auditTo, setAuditTo] = useState(today);
  const [auditLimit, setAuditLimit] = useState('20');
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [tenantSettingsLoading, setTenantSettingsLoading] = useState(false);
  const [tenantSettingsError, setTenantSettingsError] = useState('');
  const [tenantSettingsSuccess, setTenantSettingsSuccess] = useState('');
  const [tenantSettings, setTenantSettings] = useState<TenantSettingsResponse | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [timeZone, setTimeZone] = useState('UTC');
  const [locale, setLocale] = useState<'es' | 'en'>('es');
  const [bookingFormFieldsText, setBookingFormFieldsText] = useState('[]');
  const [reminderHoursBeforeText, setReminderHoursBeforeText] = useState('24');
  const [refundPolicy, setRefundPolicy] = useState<'full' | 'credit' | 'none'>('none');
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
  const [quickWaitlistServiceId, setQuickWaitlistServiceId] = useState('');
  const [quickWaitlistStaffId, setQuickWaitlistStaffId] = useState('');
  const [quickWaitlistPreferredStartAt, setQuickWaitlistPreferredStartAt] = useState('');
  const [quickWaitlistCustomerName, setQuickWaitlistCustomerName] = useState('');
  const [quickWaitlistCustomerEmail, setQuickWaitlistCustomerEmail] = useState('');
  const [quickWaitlistNotes, setQuickWaitlistNotes] = useState('');
  const [quickWaitlistLoading, setQuickWaitlistLoading] = useState(false);
  const [quickWaitlistError, setQuickWaitlistError] = useState('');
  const [quickWaitlistSuccess, setQuickWaitlistSuccess] = useState('');
  const [quickPaymentBookingId, setQuickPaymentBookingId] = useState('');
  const [quickPaymentMode, setQuickPaymentMode] = useState<'full' | 'deposit'>('full');
  const [quickPaymentAmount, setQuickPaymentAmount] = useState('');
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<(typeof PAYMENT_METHOD_OPTIONS)[number]>('cash');
  const [quickPaymentNotes, setQuickPaymentNotes] = useState('');
  const [quickPaymentLoading, setQuickPaymentLoading] = useState(false);
  const [quickPaymentError, setQuickPaymentError] = useState('');
  const [quickPaymentSuccess, setQuickPaymentSuccess] = useState('');
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [stripeSuccess, setStripeSuccess] = useState('');
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState('');
  const [stripeSessionId, setStripeSessionId] = useState('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [saleNoteLoadingId, setSaleNoteLoadingId] = useState('');
  const [saleNote, setSaleNote] = useState<SaleNoteResponse | null>(null);
  const [saleNoteError, setSaleNoteError] = useState('');
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRuleItem[]>([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<AvailabilityExceptionItem[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityActionLoadingId, setAvailabilityActionLoadingId] = useState('');
  const [availabilityActionError, setAvailabilityActionError] = useState('');
  const [availabilityActionSuccess, setAvailabilityActionSuccess] = useState('');
  const [availabilityExceptionNoteDrafts, setAvailabilityExceptionNoteDrafts] = useState<Record<string, string>>({});
  const [availabilityExceptionUnavailableDrafts, setAvailabilityExceptionUnavailableDrafts] = useState<Record<string, boolean>>({});

  useAutoDismissSuccess(quickServiceSuccess, () => setQuickServiceSuccess(''));
  useAutoDismissSuccess(quickStaffSuccess, () => setQuickStaffSuccess(''));
  useAutoDismissSuccess(quickBookingSuccess, () => setQuickBookingSuccess(''));
  useAutoDismissSuccess(quickRuleSuccess, () => setQuickRuleSuccess(''));
  useAutoDismissSuccess(quickExceptionSuccess, () => setQuickExceptionSuccess(''));
  useAutoDismissSuccess(quickWaitlistSuccess, () => setQuickWaitlistSuccess(''));
  useAutoDismissSuccess(quickPaymentSuccess, () => setQuickPaymentSuccess(''));
  useAutoDismissSuccess(stripeSuccess, () => setStripeSuccess(''));
  useAutoDismissSuccess(bookingActionSuccess, () => setBookingActionSuccess(''));
  useAutoDismissSuccess(availabilityActionSuccess, () => setAvailabilityActionSuccess(''));
  useAutoDismissSuccess(tenantSettingsSuccess, () => setTenantSettingsSuccess(''));

  useEffect(() => {
    if (quickServiceSuccess) {
      setQuickServiceError('');
    }
  }, [quickServiceSuccess]);

  useEffect(() => {
    if (quickStaffSuccess) {
      setQuickStaffError('');
    }
  }, [quickStaffSuccess]);

  useEffect(() => {
    if (quickBookingSuccess) {
      setQuickBookingError('');
    }
  }, [quickBookingSuccess]);

  useEffect(() => {
    if (quickRuleSuccess) {
      setQuickRuleError('');
    }
  }, [quickRuleSuccess]);

  useEffect(() => {
    if (quickExceptionSuccess) {
      setQuickExceptionError('');
    }
  }, [quickExceptionSuccess]);

  useEffect(() => {
    if (quickWaitlistSuccess) {
      setQuickWaitlistError('');
    }
  }, [quickWaitlistSuccess]);

  useEffect(() => {
    if (quickPaymentSuccess) {
      setQuickPaymentError('');
      setPaymentsError('');
    }
  }, [quickPaymentSuccess]);

  useEffect(() => {
    if (stripeSuccess) {
      setStripeError('');
    }
  }, [stripeSuccess]);

  useEffect(() => {
    if (bookingActionSuccess) {
      setBookingActionError('');
    }
  }, [bookingActionSuccess]);

  useEffect(() => {
    if (availabilityActionSuccess) {
      setAvailabilityActionError('');
      setAvailabilityError('');
    }
  }, [availabilityActionSuccess]);

  useEffect(() => {
    if (tenantSettingsSuccess) {
      setTenantSettingsError('');
    }
  }, [tenantSettingsSuccess]);

  const quickServiceDurationNumber = Number(quickServiceDuration);
  const quickServicePriceNumber = Number(quickServicePrice);

  const canSubmitQuickService =
    !!token.trim() &&
    !quickServiceLoading &&
    !!quickServiceName.trim() &&
    Number.isFinite(quickServiceDurationNumber) &&
    Number.isInteger(quickServiceDurationNumber) &&
    quickServiceDurationNumber >= 5 &&
    Number.isFinite(quickServicePriceNumber) &&
    quickServicePriceNumber >= 0;

  const canSubmitQuickStaff =
    !!token.trim() && !quickStaffLoading && !!quickStaffName.trim() && looksLikeEmail(quickStaffEmail);

  const canSubmitQuickBooking =
    !!token.trim() &&
    !quickBookingLoading &&
    !!quickBookingServiceId &&
    !!quickBookingStaffId &&
    !!quickBookingStartAt.trim() &&
    !Number.isNaN(new Date(quickBookingStartAt).getTime()) &&
    !!quickBookingCustomerName.trim() &&
    looksLikeEmail(quickBookingCustomerEmail);

  const canSubmitQuickRule =
    !!token.trim() &&
    !quickRuleLoading &&
    !!quickRuleStaffId &&
    /^\d{2}:\d{2}$/.test(quickRuleStartTime) &&
    /^\d{2}:\d{2}$/.test(quickRuleEndTime) &&
    quickRuleStartTime < quickRuleEndTime;

  const canSubmitQuickException =
    !!token.trim() &&
    !quickExceptionLoading &&
    !!quickExceptionStaffId &&
    /^\d{4}-\d{2}-\d{2}$/.test(quickExceptionDate) &&
    (quickExceptionFullDay ||
      (/^\d{2}:\d{2}$/.test(quickExceptionStartTime) &&
        /^\d{2}:\d{2}$/.test(quickExceptionEndTime) &&
        quickExceptionStartTime < quickExceptionEndTime));

  const canSubmitQuickWaitlist =
    !!token.trim() &&
    !quickWaitlistLoading &&
    !!quickWaitlistServiceId &&
    !!quickWaitlistStaffId &&
    !!quickWaitlistPreferredStartAt.trim() &&
    !Number.isNaN(new Date(quickWaitlistPreferredStartAt).getTime()) &&
    !!quickWaitlistCustomerName.trim() &&
    looksLikeEmail(quickWaitlistCustomerEmail);

  const quickPaymentAmountNumber = Number(quickPaymentAmount);
  const canSubmitQuickPayment =
    !!token.trim() &&
    !quickPaymentLoading &&
    !!quickPaymentBookingId &&
    (quickPaymentMode === 'full' || (Number.isFinite(quickPaymentAmountNumber) && quickPaymentAmountNumber > 0));

  const quickServiceDisabledReason = !token.trim()
    ? 'Inicia sesión para crear servicios.'
    : quickServiceLoading
      ? ''
      : !quickServiceName.trim()
        ? 'Completa el nombre del servicio.'
        : !Number.isFinite(quickServiceDurationNumber) || !Number.isInteger(quickServiceDurationNumber) || quickServiceDurationNumber < 5
          ? 'Duración mínima: 5 minutos.'
          : !Number.isFinite(quickServicePriceNumber) || quickServicePriceNumber < 0
            ? 'Ingresa un precio válido.'
            : '';

  const quickStaffDisabledReason = !token.trim()
    ? 'Inicia sesión para crear staff.'
    : quickStaffLoading
      ? ''
      : !quickStaffName.trim()
        ? 'Completa el nombre del staff.'
        : !looksLikeEmail(quickStaffEmail)
          ? 'Ingresa un email válido.'
          : '';

  const quickBookingDisabledReason = !token.trim()
    ? 'Inicia sesión para crear reservas.'
    : quickBookingLoading
      ? ''
      : !quickBookingServiceId
        ? 'Selecciona un servicio.'
        : !quickBookingStaffId
          ? 'Selecciona un staff.'
          : !quickBookingStartAt.trim() || Number.isNaN(new Date(quickBookingStartAt).getTime())
            ? 'Ingresa una fecha/hora válida.'
            : !quickBookingCustomerName.trim()
              ? 'Completa el nombre del cliente.'
              : !looksLikeEmail(quickBookingCustomerEmail)
                ? 'Ingresa un email de cliente válido.'
                : '';

  const quickRuleDisabledReason = !token.trim()
    ? 'Inicia sesión para crear reglas.'
    : quickRuleLoading
      ? ''
      : !quickRuleStaffId
        ? 'Selecciona un staff para la regla.'
        : !/^\d{2}:\d{2}$/.test(quickRuleStartTime) || !/^\d{2}:\d{2}$/.test(quickRuleEndTime)
          ? 'Completa horas válidas en formato HH:mm.'
          : quickRuleStartTime >= quickRuleEndTime
            ? 'La hora de inicio debe ser menor a la hora de fin.'
            : '';

  const quickExceptionDisabledReason = !token.trim()
    ? 'Inicia sesión para crear excepciones.'
    : quickExceptionLoading
      ? ''
      : !quickExceptionStaffId
        ? 'Selecciona un staff para la excepción.'
        : !/^\d{4}-\d{2}-\d{2}$/.test(quickExceptionDate)
          ? 'Ingresa una fecha válida.'
          : !quickExceptionFullDay &&
              (!/^\d{2}:\d{2}$/.test(quickExceptionStartTime) ||
                !/^\d{2}:\d{2}$/.test(quickExceptionEndTime) ||
                quickExceptionStartTime >= quickExceptionEndTime)
            ? 'Para excepción parcial, completa horas válidas (inicio < fin).'
            : '';

  const quickWaitlistDisabledReason = !token.trim()
    ? 'Inicia sesión para gestionar waitlist.'
    : quickWaitlistLoading
      ? ''
      : !quickWaitlistServiceId
        ? 'Selecciona un servicio.'
        : !quickWaitlistStaffId
          ? 'Selecciona un staff.'
          : !quickWaitlistPreferredStartAt.trim() || Number.isNaN(new Date(quickWaitlistPreferredStartAt).getTime())
            ? 'Ingresa una fecha/hora preferida válida.'
            : !quickWaitlistCustomerName.trim()
              ? 'Completa el nombre del cliente.'
              : !looksLikeEmail(quickWaitlistCustomerEmail)
                ? 'Ingresa un email de cliente válido.'
                : '';

  const quickPaymentDisabledReason = !token.trim()
    ? 'Inicia sesión para registrar pagos.'
    : quickPaymentLoading
      ? ''
      : !quickPaymentBookingId
        ? 'Carga calendario y selecciona una reserva.'
        : quickPaymentMode === 'deposit' && (!Number.isFinite(quickPaymentAmountNumber) || quickPaymentAmountNumber <= 0)
          ? 'Para depósito indica un monto mayor a 0.'
          : '';

  useDashboardBoot({
    apiUrl,
    token,
    tokenStorageKey: TOKEN_KEY,
    apiUrlStorageKey: API_URL_KEY,
    onMissingToken: () => router.replace('/login'),
    staffId,
    quickBookingStaffId,
    quickRuleStaffId,
    quickExceptionStaffId,
    quickWaitlistStaffId,
    quickBookingServiceId,
    quickWaitlistServiceId,
    setToken,
    setApiUrl,
    setStaffLoading,
    setServiceLoading,
    setStaffError,
    setServiceError,
    setStaffOptions,
    setServiceOptions,
    setStaffId,
    setQuickBookingStaffId,
    setQuickRuleStaffId,
    setQuickExceptionStaffId,
    setQuickWaitlistStaffId,
    setQuickBookingServiceId,
    setQuickWaitlistServiceId
  });

  useEffect(() => {
    if (!token.trim()) {
      setAvailabilityRules([]);
      setAvailabilityExceptions([]);
      setPayments([]);
      setSaleNote(null);
      setAvailabilityError('');
      return;
    }

    void loadAvailabilityData();
    void loadTenantSettings();
    void loadPayments();
  }, [apiUrl, token]);

  useEffect(() => {
    if (!data?.bookings?.length) {
      return;
    }

    if (!data.bookings.some((entry) => entry.id === quickPaymentBookingId)) {
      setQuickPaymentBookingId(data.bookings[0].id);
    }
  }, [data, quickPaymentBookingId]);

  function onLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setData(null);
    setReports(null);
    setPayments([]);
    setSaleNote(null);
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

  async function loadAvailabilityData() {
    setAvailabilityError('');

    const parsed = availabilityListSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim()
    });

    if (!parsed.success) {
      setAvailabilityError(parsed.error.issues[0]?.message ?? 'Datos inválidos para consultar disponibilidad.');
      return;
    }

    setAvailabilityLoading(true);

    try {
      const [rulesResponse, exceptionsResponse] = await Promise.all([
        fetch(new URL('/availability/rules', parsed.data.apiUrl).toString(), {
          headers: {
            Authorization: `Bearer ${parsed.data.token}`
          }
        }),
        fetch(new URL('/availability/exceptions', parsed.data.apiUrl).toString(), {
          headers: {
            Authorization: `Bearer ${parsed.data.token}`
          }
        })
      ]);

      if (!rulesResponse.ok) {
        const text = await rulesResponse.text();
        throw new Error(text || `Error ${rulesResponse.status}`);
      }

      if (!exceptionsResponse.ok) {
        const text = await exceptionsResponse.text();
        throw new Error(text || `Error ${exceptionsResponse.status}`);
      }

      const rulesPayload = (await rulesResponse.json()) as AvailabilityRuleItem[];
      const exceptionsPayload = (await exceptionsResponse.json()) as AvailabilityExceptionItem[];
      setAvailabilityRules(rulesPayload ?? []);
      setAvailabilityExceptions(exceptionsPayload ?? []);
      setAvailabilityExceptionNoteDrafts(() => {
        const next: Record<string, string> = {};
        for (const entry of exceptionsPayload ?? []) {
          next[entry.id] = entry.note ?? '';
        }
        return next;
      });
      setAvailabilityExceptionUnavailableDrafts(() => {
        const next: Record<string, boolean> = {};
        for (const entry of exceptionsPayload ?? []) {
          next[entry.id] = entry.isUnavailable;
        }
        return next;
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo cargar disponibilidad';
      setAvailabilityError(message);
      setAvailabilityRules([]);
      setAvailabilityExceptions([]);
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function loadTenantSettings() {
    setTenantSettingsError('');

    const parsed = tenantSettingsSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim()
    });

    if (!parsed.success) {
      setTenantSettingsError(parsed.error.issues[0]?.message ?? 'Datos inválidos para tenant settings.');
      return;
    }

    setTenantSettingsLoading(true);

    try {
      const response = await fetch(new URL('/tenant/settings', parsed.data.apiUrl).toString(), {
        headers: {
          Authorization: `Bearer ${parsed.data.token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as TenantSettingsResponse;
      setTenantSettings(payload);
      setLogoUrl(payload.logoUrl ?? '');
      setPrimaryColor(payload.primaryColor ?? '#2563eb');
      setTimeZone(payload.timeZone ?? 'UTC');
      setLocale(payload.locale ?? 'es');
      setBookingFormFieldsText(JSON.stringify(payload.bookingFormFields ?? [], null, 2));
      setReminderHoursBeforeText(String(payload.reminderHoursBefore ?? 24));
      setRefundPolicy(payload.refundPolicy ?? 'none');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo cargar tenant settings';
      setTenantSettingsError(message);
      setTenantSettings(null);
    } finally {
      setTenantSettingsLoading(false);
    }
  }

  async function loadPayments() {
    setPaymentsError('');

    const parsed = paymentsQuerySchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim()
    });

    if (!parsed.success) {
      setPaymentsError(parsed.error.issues[0]?.message ?? 'No se pudieron cargar pagos.');
      return;
    }

    setPaymentsLoading(true);

    try {
      const response = await fetch(new URL('/payments', parsed.data.apiUrl).toString(), {
        headers: {
          Authorization: `Bearer ${parsed.data.token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as PaymentRecord[];
      setPayments(payload ?? []);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudieron cargar pagos';
      setPaymentsError(message);
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function onSaveBookingFormFields(event: FormEvent) {
    event.preventDefault();
    setTenantSettingsError('');
    setTenantSettingsSuccess('');

    const parsed = tenantSettingsSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim()
    });

    if (!parsed.success) {
      setTenantSettingsError(parsed.error.issues[0]?.message ?? 'Sesión inválida para guardar tenant settings.');
      return;
    }

    let fieldsPayload: Array<Record<string, unknown>>;
    const reminderHoursBeforeNumber = Number(reminderHoursBeforeText);
    try {
      const parsedJson = JSON.parse(bookingFormFieldsText || '[]') as unknown;
      if (!Array.isArray(parsedJson) || parsedJson.some((entry) => typeof entry !== 'object' || entry === null)) {
        throw new Error('bookingFormFields debe ser un array de objetos.');
      }
      fieldsPayload = parsedJson as Array<Record<string, unknown>>;
    } catch (jsonError) {
      const message = jsonError instanceof Error ? jsonError.message : 'JSON inválido para bookingFormFields.';
      setTenantSettingsError(message);
      return;
    }

    if (!Number.isFinite(reminderHoursBeforeNumber) || !Number.isInteger(reminderHoursBeforeNumber) || reminderHoursBeforeNumber < 0) {
      setTenantSettingsError('reminderHoursBefore debe ser un entero mayor o igual a 0.');
      return;
    }

    if (primaryColor.trim() && !/^#[0-9a-fA-F]{6}$/.test(primaryColor.trim())) {
      setTenantSettingsError('primaryColor debe estar en formato HEX, por ejemplo #2563eb.');
      return;
    }

    if (!timeZone.trim()) {
      setTenantSettingsError('timeZone es requerida (ej: America/Mexico_City).');
      return;
    }

    setTenantSettingsLoading(true);

    try {
      const response = await fetch(new URL('/tenant/settings', parsed.data.apiUrl).toString(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          logoUrl: logoUrl.trim() || undefined,
          primaryColor: /^#[0-9a-fA-F]{6}$/.test(primaryColor.trim()) ? primaryColor.trim() : undefined,
          timeZone: timeZone.trim(),
          locale,
          bookingFormFields: fieldsPayload,
          reminderHoursBefore: reminderHoursBeforeNumber,
          refundPolicy
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as TenantSettingsResponse;
      setTenantSettings(payload);
      setLogoUrl(payload.logoUrl ?? '');
      setPrimaryColor(payload.primaryColor ?? '#2563eb');
      setTimeZone(payload.timeZone ?? 'UTC');
      setLocale(payload.locale ?? 'es');
      setBookingFormFieldsText(JSON.stringify(payload.bookingFormFields ?? [], null, 2));
      setReminderHoursBeforeText(String(payload.reminderHoursBefore ?? reminderHoursBeforeNumber));
      setRefundPolicy(payload.refundPolicy ?? refundPolicy);
      setTenantSettingsSuccess('Settings actualizados correctamente.');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudieron guardar bookingFormFields';
      setTenantSettingsError(message);
    } finally {
      setTenantSettingsLoading(false);
    }
  }

  async function onToggleAvailabilityRule(rule: AvailabilityRuleItem) {
    setAvailabilityActionError('');
    setAvailabilityActionSuccess('');

    const parsed = availabilityListSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim()
    });

    if (!parsed.success) {
      setAvailabilityActionError(parsed.error.issues[0]?.message ?? 'No se pudo actualizar regla.');
      return;
    }

    setAvailabilityActionLoadingId(`rule-toggle-${rule.id}`);

    try {
      const response = await fetch(new URL(`/availability/rules/${rule.id}`, parsed.data.apiUrl).toString(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          isActive: !rule.isActive
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setAvailabilityActionSuccess(`Regla ${rule.isActive ? 'desactivada' : 'activada'} correctamente.`);
      await loadAvailabilityData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo actualizar regla';
      setAvailabilityActionError(message);
    } finally {
      setAvailabilityActionLoadingId('');
    }
  }

  async function onDeleteAvailabilityRule(ruleId: string) {
    setAvailabilityActionError('');
    setAvailabilityActionSuccess('');

    const parsed = availabilityListSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim()
    });

    if (!parsed.success) {
      setAvailabilityActionError(parsed.error.issues[0]?.message ?? 'No se pudo eliminar regla.');
      return;
    }

    setAvailabilityActionLoadingId(`rule-delete-${ruleId}`);

    try {
      const response = await fetch(new URL(`/availability/rules/${ruleId}`, parsed.data.apiUrl).toString(), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${parsed.data.token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setAvailabilityActionSuccess('Regla eliminada correctamente.');
      await loadAvailabilityData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo eliminar regla';
      setAvailabilityActionError(message);
    } finally {
      setAvailabilityActionLoadingId('');
    }
  }

  async function onSaveAvailabilityException(exceptionId: string) {
    setAvailabilityActionError('');
    setAvailabilityActionSuccess('');

    const parsed = availabilityListSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim()
    });

    if (!parsed.success) {
      setAvailabilityActionError(parsed.error.issues[0]?.message ?? 'No se pudo actualizar excepción.');
      return;
    }

    const exception = availabilityExceptions.find((entry) => entry.id === exceptionId);
    if (!exception) {
      setAvailabilityActionError('Excepción no encontrada en la lista actual.');
      return;
    }

    setAvailabilityActionLoadingId(`exception-save-${exceptionId}`);

    try {
      const response = await fetch(new URL(`/availability/exceptions/${exceptionId}`, parsed.data.apiUrl).toString(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          note: availabilityExceptionNoteDrafts[exceptionId] ?? '',
          isUnavailable: availabilityExceptionUnavailableDrafts[exceptionId] ?? exception.isUnavailable
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setAvailabilityActionSuccess('Excepción actualizada correctamente.');
      await loadAvailabilityData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo actualizar excepción';
      setAvailabilityActionError(message);
    } finally {
      setAvailabilityActionLoadingId('');
    }
  }

  async function onDeleteAvailabilityException(exceptionId: string) {
    setAvailabilityActionError('');
    setAvailabilityActionSuccess('');

    const parsed = availabilityListSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim()
    });

    if (!parsed.success) {
      setAvailabilityActionError(parsed.error.issues[0]?.message ?? 'No se pudo eliminar excepción.');
      return;
    }

    setAvailabilityActionLoadingId(`exception-delete-${exceptionId}`);

    try {
      const response = await fetch(new URL(`/availability/exceptions/${exceptionId}`, parsed.data.apiUrl).toString(), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${parsed.data.token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setAvailabilityActionSuccess('Excepción eliminada correctamente.');
      await loadAvailabilityData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo eliminar excepción';
      setAvailabilityActionError(message);
    } finally {
      setAvailabilityActionLoadingId('');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setReportsError('');

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
      setReports(null);
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

      const reportsUrl = new URL('/dashboard/reports', parsed.data.apiUrl);
      reportsUrl.searchParams.set('range', parsed.data.range);
      reportsUrl.searchParams.set('date', parsed.data.date);

      const [appointmentsResponse, reportsResponse] = await Promise.all([
        fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${parsed.data.token}`
          }
        }),
        fetch(reportsUrl.toString(), {
          headers: {
            Authorization: `Bearer ${parsed.data.token}`
          }
        })
      ]);

      if (!appointmentsResponse.ok) {
        const text = await appointmentsResponse.text();
        throw new Error(text || `Error ${appointmentsResponse.status}`);
      }

      if (!reportsResponse.ok) {
        const text = await reportsResponse.text();
        throw new Error(text || `Error ${reportsResponse.status}`);
      }

      const payload = (await appointmentsResponse.json()) as DashboardResponse;
      const reportsPayload = (await reportsResponse.json()) as DashboardReportsResponse;
      setData(payload);
      setReports(reportsPayload);
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
      setReports(null);
      setReportsError(message);
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
        if (!quickWaitlistServiceId) {
          setQuickWaitlistServiceId(created.id);
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
      if (!quickWaitlistStaffId && payload?.id) {
        setQuickWaitlistStaffId(payload.id);
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

  async function onCreatePayment(event: FormEvent) {
    event.preventDefault();
    setQuickPaymentError('');
    setQuickPaymentSuccess('');

    const parsed = quickCreatePaymentSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      bookingId: quickPaymentBookingId,
      mode: quickPaymentMode,
      amount: quickPaymentMode === 'deposit' ? quickPaymentAmount : undefined,
      method: quickPaymentMethod,
      notes: quickPaymentNotes.trim() || undefined
    });

    if (!parsed.success) {
      setQuickPaymentError(parsed.error.issues[0]?.message ?? 'Datos de pago inválidos.');
      return;
    }

    setQuickPaymentLoading(true);

    try {
      const response = await fetch(new URL('/payments', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          bookingId: parsed.data.bookingId,
          mode: parsed.data.mode,
          amount: parsed.data.mode === 'deposit' ? parsed.data.amount : undefined,
          method: parsed.data.method,
          notes: parsed.data.notes
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as { summary?: { outstanding?: number } };
      const outstanding = payload.summary?.outstanding;
      if (typeof outstanding === 'number') {
        setQuickPaymentSuccess(`Pago registrado. Saldo pendiente: ${outstanding.toFixed(2)} MXN.`);
      } else {
        setQuickPaymentSuccess('Pago registrado correctamente.');
      }

      setQuickPaymentAmount('');
      setQuickPaymentNotes('');
      await loadPayments();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo registrar pago';
      setQuickPaymentError(message);
    } finally {
      setQuickPaymentLoading(false);
    }
  }

  async function onLoadSaleNote(paymentId: string) {
    setSaleNoteError('');

    const parsed = paymentsQuerySchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim()
    });

    if (!parsed.success) {
      setSaleNoteError(parsed.error.issues[0]?.message ?? 'Sesión inválida para nota de venta.');
      return;
    }

    setSaleNoteLoadingId(paymentId);

    try {
      const response = await fetch(new URL(`/payments/${paymentId}/sale-note`, parsed.data.apiUrl).toString(), {
        headers: {
          Authorization: `Bearer ${parsed.data.token}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as SaleNoteResponse;
      setSaleNote(payload);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo cargar nota de venta';
      setSaleNoteError(message);
      setSaleNote(null);
    } finally {
      setSaleNoteLoadingId('');
    }
  }

  async function onCreateStripeCheckoutSession() {
    setStripeError('');
    setStripeSuccess('');

    const parsed = quickCreateStripeCheckoutSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      bookingId: quickPaymentBookingId,
      mode: quickPaymentMode,
      amount: quickPaymentMode === 'deposit' ? quickPaymentAmount : undefined
    });

    if (!parsed.success) {
      setStripeError(parsed.error.issues[0]?.message ?? 'Datos inválidos para checkout Stripe.');
      return;
    }

    setStripeLoading(true);

    try {
      const response = await fetch(new URL('/payments/stripe/checkout-session', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          bookingId: parsed.data.bookingId,
          mode: parsed.data.mode,
          amount: parsed.data.mode === 'deposit' ? parsed.data.amount : undefined
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as {
        sessionId?: string;
        url?: string;
        amount?: number;
        currency?: string;
      };

      setStripeSessionId(payload.sessionId ?? '');
      setStripeCheckoutUrl(payload.url ?? '');
      if (typeof payload.amount === 'number' && payload.currency) {
        setStripeSuccess(`Checkout Stripe creado por ${payload.amount.toFixed(2)} ${payload.currency}.`);
      } else {
        setStripeSuccess('Checkout Stripe creado correctamente.');
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo crear checkout Stripe';
      setStripeError(message);
      setStripeCheckoutUrl('');
    } finally {
      setStripeLoading(false);
    }
  }

  async function onConfirmStripeSession() {
    setStripeError('');
    setStripeSuccess('');

    const parsed = quickConfirmStripeSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      sessionId: stripeSessionId
    });

    if (!parsed.success) {
      setStripeError(parsed.error.issues[0]?.message ?? 'sessionId de Stripe inválido.');
      return;
    }

    setStripeLoading(true);

    try {
      const response = await fetch(new URL('/payments/stripe/confirm', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          sessionId: parsed.data.sessionId
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      const payload = (await response.json()) as { alreadyConfirmed?: boolean };
      setStripeSuccess(payload.alreadyConfirmed ? 'La sesión Stripe ya estaba confirmada.' : 'Pago Stripe confirmado correctamente.');
      await loadPayments();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo confirmar la sesión Stripe';
      setStripeError(message);
    } finally {
      setStripeLoading(false);
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
      await loadAvailabilityData();
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
      await loadAvailabilityData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo crear excepción de disponibilidad';
      setQuickExceptionError(message);
    } finally {
      setQuickExceptionLoading(false);
    }
  }

  async function onJoinWaitlist(event: FormEvent) {
    event.preventDefault();
    setQuickWaitlistError('');
    setQuickWaitlistSuccess('');

    const parsed = quickJoinWaitlistSchema.safeParse({
      apiUrl: apiUrl.trim(),
      token: token.trim(),
      serviceId: quickWaitlistServiceId,
      staffId: quickWaitlistStaffId,
      preferredStartAt: quickWaitlistPreferredStartAt,
      customerName: quickWaitlistCustomerName,
      customerEmail: quickWaitlistCustomerEmail,
      notes: quickWaitlistNotes.trim() || undefined
    });

    if (!parsed.success) {
      setQuickWaitlistError(parsed.error.issues[0]?.message ?? 'Datos de waitlist inválidos.');
      return;
    }

    const preferredDate = new Date(parsed.data.preferredStartAt);
    if (Number.isNaN(preferredDate.getTime())) {
      setQuickWaitlistError('Fecha/hora preferida inválida.');
      return;
    }

    setQuickWaitlistLoading(true);

    try {
      const response = await fetch(new URL('/bookings/waitlist', parsed.data.apiUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.data.token}`
        },
        body: JSON.stringify({
          serviceId: parsed.data.serviceId,
          staffId: parsed.data.staffId,
          preferredStartAt: preferredDate.toISOString(),
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          notes: parsed.data.notes
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      setQuickWaitlistSuccess('Cliente agregado a lista de espera.');
      setQuickWaitlistPreferredStartAt('');
      setQuickWaitlistCustomerName('');
      setQuickWaitlistCustomerEmail('');
      setQuickWaitlistNotes('');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo agregar a waitlist';
      setQuickWaitlistError(message);
    } finally {
      setQuickWaitlistLoading(false);
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

  function openOperationsView(view: OperationsView) {
    setActiveSection('operations');
    setOperationsOpen(true);
    setOperationsView(view);
  }

  const brandPrimary = /^#[0-9a-fA-F]{6}$/.test(primaryColor.trim()) ? primaryColor.trim() : '#2563eb';
  const brandTint = `${brandPrimary}1A`;

  return (
    <main className="dashboard-layout">
      <aside className="dashboard-sidebar surface">
        <div className="sidebar-brand">
          <div className="sidebar-logo" style={{ background: brandTint, color: brandPrimary }}>
            {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: 22, height: 22, objectFit: 'contain' }} /> : <Building2 size={18} />}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{tenantSettings?.name ?? 'Apoint'}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Panel de gestión</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button type="button" className={`sidebar-item ${activeSection === 'overview' ? 'active' : ''}`} onClick={() => setActiveSection('overview')}>
            <LayoutDashboard size={16} />
            <span>Resumen</span>
          </button>

          <button type="button" className={`sidebar-item ${activeSection === 'payments' ? 'active' : ''}`} onClick={() => setActiveSection('payments')}>
            <CreditCard size={16} />
            <span>Pagos</span>
          </button>

          <button
            type="button"
            className={`sidebar-item ${activeSection === 'operations' ? 'active' : ''}`}
            onClick={() => {
              setOperationsOpen((current) => !current);
              setActiveSection('operations');
            }}
          >
            <Wrench size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Operaciones</span>
            {operationsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {operationsOpen ? (
            <div className="sidebar-submenu">
              <button type="button" className="sidebar-subgroup-toggle" onClick={() => setOperationsQuickOpen((current) => !current)}>
                <span style={{ flex: 1, textAlign: 'left' }}>Acciones rápidas</span>
                {operationsQuickOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {operationsQuickOpen ? (
                <div className="sidebar-submenu-nested">
                  <button
                    type="button"
                    className={`sidebar-subitem ${operationsView === 'quick-service' ? 'active' : ''}`}
                    onClick={() => openOperationsView('quick-service')}
                  >
                    Crear servicio
                  </button>
                  <button
                    type="button"
                    className={`sidebar-subitem ${operationsView === 'quick-staff' ? 'active' : ''}`}
                    onClick={() => openOperationsView('quick-staff')}
                  >
                    Crear staff
                  </button>
                  <button
                    type="button"
                    className={`sidebar-subitem ${operationsView === 'quick-booking' ? 'active' : ''}`}
                    onClick={() => openOperationsView('quick-booking')}
                  >
                    Crear booking
                  </button>
                  <button
                    type="button"
                    className={`sidebar-subitem ${operationsView === 'quick-waitlist' ? 'active' : ''}`}
                    onClick={() => openOperationsView('quick-waitlist')}
                  >
                    Waitlist
                  </button>
                </div>
              ) : null}

              <button type="button" className="sidebar-subgroup-toggle" onClick={() => setOperationsAvailabilityOpen((current) => !current)}>
                <span style={{ flex: 1, textAlign: 'left' }}>Disponibilidad</span>
                {operationsAvailabilityOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {operationsAvailabilityOpen ? (
                <div className="sidebar-submenu-nested">
                  <button
                    type="button"
                    className={`sidebar-subitem ${operationsView === 'availability-overview' ? 'active' : ''}`}
                    onClick={() => openOperationsView('availability-overview')}
                  >
                    Panel disponibilidad
                  </button>
                  <button
                    type="button"
                    className={`sidebar-subitem ${operationsView === 'availability-rules' ? 'active' : ''}`}
                    onClick={() => openOperationsView('availability-rules')}
                  >
                    Reglas
                  </button>
                  <button
                    type="button"
                    className={`sidebar-subitem ${operationsView === 'availability-exceptions' ? 'active' : ''}`}
                    onClick={() => openOperationsView('availability-exceptions')}
                  >
                    Excepciones
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <button type="button" className={`sidebar-item ${activeSection === 'settings' ? 'active' : ''}`} onClick={() => setActiveSection('settings')}>
            <Settings size={16} />
            <span>Settings</span>
          </button>

          <button type="button" className={`sidebar-item ${activeSection === 'audit' ? 'active' : ''}`} onClick={() => setActiveSection('audit')}>
            <ClipboardList size={16} />
            <span>Auditoría</span>
          </button>
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar surface">
          <div className="topbar-left">
            <div className="topbar-logo" style={{ background: brandTint, color: brandPrimary }}>
              {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: 20, height: 20, objectFit: 'contain' }} /> : <Building2 size={16} />}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{tenantSettings?.name ?? 'Apoint'}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Calendario, pagos y operación</div>
            </div>
          </div>

          <div className="topbar-right">
            <div style={{ position: 'relative' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setUserMenuOpen((current) => !current)}>
                <UserCircle2 size={16} />
                Usuario
              </button>
              {userMenuOpen ? (
                <div className="panel" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 220, zIndex: 10 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Sesión activa</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{tenantSettings?.name ?? 'Negocio'}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>API: {apiUrl}</div>
                </div>
              ) : null}
            </div>

            <button type="button" onClick={onLogout} className="btn btn-ghost">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>

        <div className="dashboard-content">
      {activeSection === 'overview' ? (
        <OverviewSection
          onSubmit={onSubmit}
          apiUrl={apiUrl}
          setApiUrl={setApiUrl}
          range={range}
          setRange={setRange}
          date={date}
          setDate={setDate}
          staffId={staffId}
          setStaffId={setStaffId}
          status={status}
          setStatus={setStatus}
          staffLoading={staffLoading}
          staffOptions={staffOptions}
          statusOptions={STATUS_OPTIONS}
          staffError={staffError}
          setStaffError={setStaffError}
          serviceError={serviceError}
          setServiceError={setServiceError}
          loading={loading}
          token={token}
          error={error}
          setError={setError}
          reportsError={reportsError}
          setReportsError={setReportsError}
          bookingActionError={bookingActionError}
          setBookingActionError={setBookingActionError}
          bookingActionSuccess={bookingActionSuccess}
          setBookingActionSuccess={setBookingActionSuccess}
          data={data}
          onCancelBooking={onCancelBooking}
          onRescheduleBooking={onRescheduleBooking}
          bookingActionLoadingId={bookingActionLoadingId}
          rescheduleDrafts={rescheduleDrafts}
          setRescheduleDrafts={setRescheduleDrafts}
          reports={reports}
        />
      ) : null}

      {activeSection === 'payments' ? (
        <PaymentsSection
          token={token}
          paymentsLoading={paymentsLoading}
          loadPayments={loadPayments}
          onCreatePayment={onCreatePayment}
          quickPaymentBookingId={quickPaymentBookingId}
          setQuickPaymentBookingId={setQuickPaymentBookingId}
          data={data}
          quickPaymentMode={quickPaymentMode}
          setQuickPaymentMode={setQuickPaymentMode}
          quickPaymentMethod={quickPaymentMethod}
          setQuickPaymentMethod={setQuickPaymentMethod}
          paymentMethodOptions={PAYMENT_METHOD_OPTIONS}
          quickPaymentAmount={quickPaymentAmount}
          setQuickPaymentAmount={setQuickPaymentAmount}
          quickPaymentNotes={quickPaymentNotes}
          setQuickPaymentNotes={setQuickPaymentNotes}
          quickPaymentLoading={quickPaymentLoading}
          canSubmitQuickPayment={canSubmitQuickPayment}
          quickPaymentDisabledReason={quickPaymentDisabledReason}
          quickPaymentError={quickPaymentError}
          setQuickPaymentError={setQuickPaymentError}
          quickPaymentSuccess={quickPaymentSuccess}
          setQuickPaymentSuccess={setQuickPaymentSuccess}
          stripeError={stripeError}
          setStripeError={setStripeError}
          stripeSuccess={stripeSuccess}
          setStripeSuccess={setStripeSuccess}
          stripeLoading={stripeLoading}
          onCreateStripeCheckoutSession={onCreateStripeCheckoutSession}
          stripeCheckoutUrl={stripeCheckoutUrl}
          stripeSessionId={stripeSessionId}
          setStripeSessionId={setStripeSessionId}
          onConfirmStripeSession={onConfirmStripeSession}
          paymentsError={paymentsError}
          setPaymentsError={setPaymentsError}
          payments={payments}
          saleNoteLoadingId={saleNoteLoadingId}
          onLoadSaleNote={onLoadSaleNote}
          saleNoteError={saleNoteError}
          setSaleNoteError={setSaleNoteError}
          saleNote={saleNote}
        />
      ) : null}

      {activeSection === 'operations' ? (
        <OperationsSection
          operationsView={operationsView}
          token={token}
          serviceLoading={serviceLoading}
          staffLoading={staffLoading}
          onCreateService={onCreateService}
          quickServiceName={quickServiceName}
          setQuickServiceName={setQuickServiceName}
          quickServiceDuration={quickServiceDuration}
          setQuickServiceDuration={setQuickServiceDuration}
          quickServicePrice={quickServicePrice}
          setQuickServicePrice={setQuickServicePrice}
          canSubmitQuickService={canSubmitQuickService}
          quickServiceLoading={quickServiceLoading}
          quickServiceDisabledReason={quickServiceDisabledReason}
          quickServiceError={quickServiceError}
          setQuickServiceError={setQuickServiceError}
          quickServiceSuccess={quickServiceSuccess}
          setQuickServiceSuccess={setQuickServiceSuccess}
          onCreateStaff={onCreateStaff}
          quickStaffName={quickStaffName}
          setQuickStaffName={setQuickStaffName}
          quickStaffEmail={quickStaffEmail}
          setQuickStaffEmail={setQuickStaffEmail}
          canSubmitQuickStaff={canSubmitQuickStaff}
          quickStaffLoading={quickStaffLoading}
          quickStaffDisabledReason={quickStaffDisabledReason}
          quickStaffError={quickStaffError}
          setQuickStaffError={setQuickStaffError}
          quickStaffSuccess={quickStaffSuccess}
          setQuickStaffSuccess={setQuickStaffSuccess}
          onCreateBooking={onCreateBooking}
          quickBookingServiceId={quickBookingServiceId}
          setQuickBookingServiceId={setQuickBookingServiceId}
          quickBookingStaffId={quickBookingStaffId}
          setQuickBookingStaffId={setQuickBookingStaffId}
          quickBookingStartAt={quickBookingStartAt}
          setQuickBookingStartAt={setQuickBookingStartAt}
          quickBookingCustomerName={quickBookingCustomerName}
          setQuickBookingCustomerName={setQuickBookingCustomerName}
          quickBookingCustomerEmail={quickBookingCustomerEmail}
          setQuickBookingCustomerEmail={setQuickBookingCustomerEmail}
          quickBookingNotes={quickBookingNotes}
          setQuickBookingNotes={setQuickBookingNotes}
          canSubmitQuickBooking={canSubmitQuickBooking}
          quickBookingLoading={quickBookingLoading}
          quickBookingDisabledReason={quickBookingDisabledReason}
          quickBookingError={quickBookingError}
          setQuickBookingError={setQuickBookingError}
          quickBookingSuccess={quickBookingSuccess}
          setQuickBookingSuccess={setQuickBookingSuccess}
          onCreateAvailabilityRule={onCreateAvailabilityRule}
          quickRuleDayOfWeek={quickRuleDayOfWeek}
          setQuickRuleDayOfWeek={setQuickRuleDayOfWeek}
          quickRuleStartTime={quickRuleStartTime}
          setQuickRuleStartTime={setQuickRuleStartTime}
          quickRuleEndTime={quickRuleEndTime}
          setQuickRuleEndTime={setQuickRuleEndTime}
          quickRuleStaffId={quickRuleStaffId}
          setQuickRuleStaffId={setQuickRuleStaffId}
          canSubmitQuickRule={canSubmitQuickRule}
          quickRuleLoading={quickRuleLoading}
          quickRuleDisabledReason={quickRuleDisabledReason}
          quickRuleError={quickRuleError}
          setQuickRuleError={setQuickRuleError}
          quickRuleSuccess={quickRuleSuccess}
          setQuickRuleSuccess={setQuickRuleSuccess}
          onCreateAvailabilityException={onCreateAvailabilityException}
          quickExceptionDate={quickExceptionDate}
          setQuickExceptionDate={setQuickExceptionDate}
          quickExceptionFullDay={quickExceptionFullDay}
          setQuickExceptionFullDay={setQuickExceptionFullDay}
          quickExceptionStartTime={quickExceptionStartTime}
          setQuickExceptionStartTime={setQuickExceptionStartTime}
          quickExceptionEndTime={quickExceptionEndTime}
          setQuickExceptionEndTime={setQuickExceptionEndTime}
          quickExceptionStaffId={quickExceptionStaffId}
          setQuickExceptionStaffId={setQuickExceptionStaffId}
          quickExceptionNote={quickExceptionNote}
          setQuickExceptionNote={setQuickExceptionNote}
          canSubmitQuickException={canSubmitQuickException}
          quickExceptionLoading={quickExceptionLoading}
          quickExceptionDisabledReason={quickExceptionDisabledReason}
          quickExceptionError={quickExceptionError}
          setQuickExceptionError={setQuickExceptionError}
          quickExceptionSuccess={quickExceptionSuccess}
          setQuickExceptionSuccess={setQuickExceptionSuccess}
          onJoinWaitlist={onJoinWaitlist}
          quickWaitlistServiceId={quickWaitlistServiceId}
          setQuickWaitlistServiceId={setQuickWaitlistServiceId}
          quickWaitlistStaffId={quickWaitlistStaffId}
          setQuickWaitlistStaffId={setQuickWaitlistStaffId}
          quickWaitlistPreferredStartAt={quickWaitlistPreferredStartAt}
          setQuickWaitlistPreferredStartAt={setQuickWaitlistPreferredStartAt}
          quickWaitlistCustomerName={quickWaitlistCustomerName}
          setQuickWaitlistCustomerName={setQuickWaitlistCustomerName}
          quickWaitlistCustomerEmail={quickWaitlistCustomerEmail}
          setQuickWaitlistCustomerEmail={setQuickWaitlistCustomerEmail}
          quickWaitlistNotes={quickWaitlistNotes}
          setQuickWaitlistNotes={setQuickWaitlistNotes}
          canSubmitQuickWaitlist={canSubmitQuickWaitlist}
          quickWaitlistLoading={quickWaitlistLoading}
          quickWaitlistDisabledReason={quickWaitlistDisabledReason}
          quickWaitlistError={quickWaitlistError}
          setQuickWaitlistError={setQuickWaitlistError}
          quickWaitlistSuccess={quickWaitlistSuccess}
          setQuickWaitlistSuccess={setQuickWaitlistSuccess}
          serviceOptions={serviceOptions}
          staffOptions={staffOptions}
          availabilityLoading={availabilityLoading}
          loadAvailabilityData={loadAvailabilityData}
          availabilityError={availabilityError}
          setAvailabilityError={setAvailabilityError}
          availabilityActionError={availabilityActionError}
          setAvailabilityActionError={setAvailabilityActionError}
          availabilityActionSuccess={availabilityActionSuccess}
          setAvailabilityActionSuccess={setAvailabilityActionSuccess}
          availabilityRules={availabilityRules}
          availabilityExceptions={availabilityExceptions}
          availabilityActionLoadingId={availabilityActionLoadingId}
          onToggleAvailabilityRule={onToggleAvailabilityRule}
          onDeleteAvailabilityRule={onDeleteAvailabilityRule}
          availabilityExceptionUnavailableDrafts={availabilityExceptionUnavailableDrafts}
          setAvailabilityExceptionUnavailableDrafts={setAvailabilityExceptionUnavailableDrafts}
          availabilityExceptionNoteDrafts={availabilityExceptionNoteDrafts}
          setAvailabilityExceptionNoteDrafts={setAvailabilityExceptionNoteDrafts}
          onSaveAvailabilityException={onSaveAvailabilityException}
          onDeleteAvailabilityException={onDeleteAvailabilityException}
        />
      ) : null}

      {activeSection === 'settings' ? (
        <SettingsSection
          tenantSettings={tenantSettings}
          tenantSettingsLoading={tenantSettingsLoading}
          token={token}
          loadTenantSettings={loadTenantSettings}
          tenantSettingsError={tenantSettingsError}
          setTenantSettingsError={setTenantSettingsError}
          tenantSettingsSuccess={tenantSettingsSuccess}
          setTenantSettingsSuccess={setTenantSettingsSuccess}
          onSaveBookingFormFields={onSaveBookingFormFields}
          logoUrl={logoUrl}
          setLogoUrl={setLogoUrl}
          primaryColor={primaryColor}
          setPrimaryColor={setPrimaryColor}
          timeZone={timeZone}
          setTimeZone={setTimeZone}
          locale={locale}
          setLocale={setLocale}
          refundPolicy={refundPolicy}
          setRefundPolicy={setRefundPolicy}
          reminderHoursBeforeText={reminderHoursBeforeText}
          setReminderHoursBeforeText={setReminderHoursBeforeText}
          bookingFormFieldsText={bookingFormFieldsText}
          setBookingFormFieldsText={setBookingFormFieldsText}
        />
      ) : null}

      {activeSection === 'audit' ? (
        <AuditSection
          auditAction={auditAction}
          setAuditAction={setAuditAction}
          auditActorUserId={auditActorUserId}
          setAuditActorUserId={setAuditActorUserId}
          auditFrom={auditFrom}
          setAuditFrom={setAuditFrom}
          auditTo={auditTo}
          setAuditTo={setAuditTo}
          auditLimit={auditLimit}
          setAuditLimit={setAuditLimit}
          auditLoading={auditLoading}
          token={token}
          loadAuditLogs={loadAuditLogs}
          auditCursor={auditCursor}
          auditError={auditError}
          setAuditError={setAuditError}
          auditLogs={auditLogs}
        />
      ) : null}
        </div>
      </section>
    </main>
  );
}
