export type StaffMember = {
  id: string;
  fullName: string;
};

export type ServiceItem = {
  id: string;
  name: string;
};

export type AvailabilityRuleItem = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  staffId: string | null;
};

export type AvailabilityExceptionItem = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isUnavailable: boolean;
  note: string | null;
  staffId: string | null;
};

export type DashboardResponse = {
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

export type DashboardReportsResponse = {
  range: 'day' | 'week' | 'month';
  period: {
    start: string;
    end: string;
  };
  totals: {
    totalAppointments: number;
    cancelledAppointments: number;
    cancellationRate: number;
    netRevenue: number;
  };
  topCustomers: Array<{
    customerName: string;
    customerEmail: string;
    totalBookings: number;
  }>;
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    totalBookings: number;
  }>;
  peakHours: Array<{
    hour: number;
    total: number;
  }>;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorUserId: string | null;
  createdAt: string;
};

export type AuditLogsResponse = {
  items: AuditLogEntry[];
  nextCursor: string | null;
};

export type TenantSettingsResponse = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  primaryColor: string | null;
  bookingBufferMinutes: number;
  maxBookingsPerDay: number | null;
  maxBookingsPerWeek: number | null;
  cancellationNoticeHours: number;
  rescheduleNoticeHours: number;
  reminderHoursBefore: number;
  refundPolicy: 'full' | 'credit' | 'none';
  bookingFormFields: Array<Record<string, unknown>> | null;
};

export type PaymentRecord = {
  id: string;
  kind: 'full' | 'deposit' | 'refund';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  method: 'cash' | 'card' | 'transfer' | 'link' | 'stripe' | 'mercadopago';
  amount: string;
  currency: string;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    customerName: string;
    customerEmail: string;
    startAt: string;
    service: {
      id: string;
      name: string;
      price: string;
    };
  };
};

export type SaleNoteResponse = {
  folio: string;
  issuedAt: string;
  tenant: {
    name: string;
    slug: string;
  };
  payment: {
    id: string;
    kind: string;
    status: string;
    method: string;
    amount: number;
    currency: string;
    notes: string | null;
  };
  booking: {
    id: string;
    customerName: string;
    customerEmail: string;
    startAt: string;
    serviceName: string;
    servicePrice: number;
    staffName: string;
  };
};
