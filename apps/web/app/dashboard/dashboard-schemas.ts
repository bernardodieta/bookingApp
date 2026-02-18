import { z } from 'zod';

export const STATUS_OPTIONS = ['pending', 'confirmed', 'cancelled', 'rescheduled', 'no_show', 'completed'] as const;
export const PAYMENT_METHOD_OPTIONS = ['cash', 'card', 'transfer', 'link', 'stripe'] as const;

export const DAY_OF_WEEK_LABEL: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado'
};

export const dashboardFilterSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  range: z.enum(['day', 'week', 'month']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida. Usa formato YYYY-MM-DD.'),
  staffId: z.string().optional(),
  status: z.union([z.literal(''), z.enum(STATUS_OPTIONS)]),
  token: z.string().min(1, 'Token de sesión inválido.')
});

export const auditFilterSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  action: z.string().optional(),
  actorUserId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(200)
});

export const tenantSettingsSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.')
});

export const quickCreateServiceSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  name: z.string().trim().min(1, 'Nombre de servicio requerido.'),
  durationMinutes: z.coerce.number().int().min(5, 'Duración mínima: 5 minutos.'),
  price: z.coerce.number().min(0, 'Precio inválido.')
});

export const quickCreateStaffSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  fullName: z.string().trim().min(1, 'Nombre de staff requerido.'),
  email: z.string().trim().email('Email de staff inválido.')
});

export const quickCreateBookingSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  serviceId: z.string().trim().min(1, 'Selecciona un servicio.'),
  staffId: z.string().trim().min(1, 'Selecciona un staff.'),
  startAt: z.string().trim().min(1, 'Fecha/hora requerida.'),
  customerName: z.string().trim().min(1, 'Nombre de cliente requerido.'),
  customerEmail: z.string().trim().email('Email de cliente inválido.'),
  notes: z.string().optional()
});

export const quickCreateAvailabilityRuleSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inicio inválida. Usa HH:mm.'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Hora fin inválida. Usa HH:mm.'),
  staffId: z.string().trim().min(1, 'Selecciona staff para la regla.')
});

export const quickCreateAvailabilityExceptionSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida. Usa YYYY-MM-DD.'),
  fullDay: z.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  staffId: z.string().trim().min(1, 'Selecciona staff para la excepción.'),
  note: z.string().optional()
});

export const quickCancelBookingSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  bookingId: z.string().trim().min(1, 'Booking inválido.')
});

export const quickRescheduleBookingSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  bookingId: z.string().trim().min(1, 'Booking inválido.'),
  startAt: z.string().trim().min(1, 'Fecha/hora requerida para reprogramar.')
});

export const quickJoinWaitlistSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  serviceId: z.string().trim().min(1, 'Selecciona un servicio.'),
  staffId: z.string().trim().min(1, 'Selecciona un staff.'),
  preferredStartAt: z.string().trim().min(1, 'Fecha/hora preferida requerida.'),
  customerName: z.string().trim().min(1, 'Nombre de cliente requerido.'),
  customerEmail: z.string().trim().email('Email de cliente inválido.'),
  notes: z.string().optional()
});

export const quickCreatePaymentSchema = z
  .object({
    apiUrl: z.string().url('API URL inválida.'),
    token: z.string().min(1, 'Token de sesión inválido.'),
    bookingId: z.string().trim().min(1, 'Selecciona una reserva para registrar el pago.'),
    mode: z.enum(['full', 'deposit']),
    amount: z.coerce.number().positive('Monto inválido para depósito.').optional(),
    method: z.enum(PAYMENT_METHOD_OPTIONS),
    notes: z.string().optional()
  })
  .superRefine((value, context) => {
    if (value.mode === 'deposit' && (typeof value.amount !== 'number' || Number.isNaN(value.amount))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Para depósito debes indicar un monto válido.',
        path: ['amount']
      });
    }
  });

export const quickCreateStripeCheckoutSchema = z
  .object({
    apiUrl: z.string().url('API URL inválida.'),
    token: z.string().min(1, 'Token de sesión inválido.'),
    bookingId: z.string().trim().min(1, 'Selecciona una reserva para Stripe.'),
    mode: z.enum(['full', 'deposit']),
    amount: z.coerce.number().positive('Monto inválido para depósito Stripe.').optional()
  })
  .superRefine((value, context) => {
    if (value.mode === 'deposit' && (typeof value.amount !== 'number' || Number.isNaN(value.amount))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Para depósito Stripe debes indicar un monto válido.',
        path: ['amount']
      });
    }
  });

export const quickConfirmStripeSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.'),
  sessionId: z.string().trim().min(1, 'Ingresa un Stripe sessionId válido.')
});

export const paymentsQuerySchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.')
});

export const availabilityListSchema = z.object({
  apiUrl: z.string().url('API URL inválida.'),
  token: z.string().min(1, 'Token de sesión inválido.')
});
