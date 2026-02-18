import { Notice } from './notice';

type PaymentsSectionProps = {
  token: string;
  paymentsLoading: boolean;
  loadPayments: () => Promise<void>;
  onCreatePayment: (event: React.FormEvent) => Promise<void>;
  quickPaymentBookingId: string;
  setQuickPaymentBookingId: (value: string) => void;
  data: {
    bookings: Array<{
      id: string;
      customerName: string;
      startAt: string;
      service: { name: string };
    }>;
  } | null;
  quickPaymentMode: 'full' | 'deposit';
  setQuickPaymentMode: (value: 'full' | 'deposit') => void;
  quickPaymentMethod: 'cash' | 'card' | 'transfer' | 'link' | 'stripe';
  setQuickPaymentMethod: (value: 'cash' | 'card' | 'transfer' | 'link' | 'stripe') => void;
  paymentMethodOptions: readonly string[];
  quickPaymentAmount: string;
  setQuickPaymentAmount: (value: string) => void;
  quickPaymentNotes: string;
  setQuickPaymentNotes: (value: string) => void;
  quickPaymentLoading: boolean;
  canSubmitQuickPayment: boolean;
  quickPaymentDisabledReason: string;
  quickPaymentError: string;
  setQuickPaymentError: (value: string) => void;
  quickPaymentSuccess: string;
  setQuickPaymentSuccess: (value: string) => void;
  stripeError?: string;
  setStripeError?: (value: string) => void;
  stripeSuccess?: string;
  setStripeSuccess?: (value: string) => void;
  stripeLoading?: boolean;
  onCreateStripeCheckoutSession?: () => Promise<void>;
  stripeCheckoutUrl?: string;
  stripeSessionId?: string;
  setStripeSessionId?: (value: string) => void;
  onConfirmStripeSession?: () => Promise<void>;
  paymentsError: string;
  setPaymentsError: (value: string) => void;
  payments: Array<{
    id: string;
    kind: string;
    amount: string;
    currency: string;
    paidAt: string | null;
    createdAt: string;
    booking: { customerName: string };
  }>;
  saleNoteLoadingId: string;
  onLoadSaleNote: (paymentId: string) => Promise<void>;
  saleNoteError: string;
  setSaleNoteError: (value: string) => void;
  saleNote: {
    folio: string;
    issuedAt: string;
    tenant: { name: string };
    booking: {
      customerName: string;
      customerEmail: string;
      serviceName: string;
      staffName: string;
    };
    payment: {
      amount: number;
      currency: string;
      method: string;
    };
  } | null;
};

export function PaymentsSection(props: PaymentsSectionProps) {
  const canUseStripe =
    typeof props.onCreateStripeCheckoutSession === 'function' &&
    typeof props.onConfirmStripeSession === 'function' &&
    typeof props.setStripeSessionId === 'function';

  const stripeSessionId = props.stripeSessionId ?? '';
  const stripeCheckoutUrl = props.stripeCheckoutUrl ?? '';
  const stripeLoading = props.stripeLoading ?? false;
  const stripeError = props.stripeError ?? '';
  const stripeSuccess = props.stripeSuccess ?? '';

  return (
    <section className="section-block" style={{ marginTop: 28 }}>
      <h2 className="section-title">Pagos (MVP)</h2>
      <p className="section-subtitle">Registra pago completo o depósito para una reserva y consulta historial reciente.</p>

      <div className="section-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          disabled={props.paymentsLoading || !props.token.trim()}
          onClick={() => {
            void props.loadPayments();
          }}
          className="btn btn-ghost section-button-md"
        >
          {props.paymentsLoading ? 'Cargando...' : 'Refresh pagos'}
        </button>
      </div>

      <div className="section-grid section-grid-2" style={{ marginBottom: 12 }}>
        <form onSubmit={props.onCreatePayment} className="panel section-form" style={{ gap: 8 }}>
          <strong>Registrar pago</strong>
          <label>
            Reserva
            <select
              value={props.quickPaymentBookingId}
              onChange={(event) => props.setQuickPaymentBookingId(event.target.value)}
              className="w-full"
              disabled={!props.data?.bookings?.length}
            >
              <option value="">Seleccionar</option>
              {(props.data?.bookings ?? []).map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.customerName} · {booking.service.name} · {new Date(booking.startAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={props.quickPaymentMode} onChange={(event) => props.setQuickPaymentMode(event.target.value as 'full' | 'deposit')} className="w-full">
              <option value="full">Pago total (saldo pendiente)</option>
              <option value="deposit">Depósito parcial</option>
            </select>
          </label>
          <label>
            Método
            <select
              value={props.quickPaymentMethod}
              onChange={(event) => props.setQuickPaymentMethod(event.target.value as 'cash' | 'card' | 'transfer' | 'link' | 'stripe')}
              className="w-full"
            >
              {props.paymentMethodOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
          <label>
            Monto (solo depósito)
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={props.quickPaymentAmount}
              onChange={(event) => props.setQuickPaymentAmount(event.target.value)}
              disabled={props.quickPaymentMode !== 'deposit'}
              className="w-full"
            />
          </label>
          <label>
            Notas (opcional)
            <input value={props.quickPaymentNotes} onChange={(event) => props.setQuickPaymentNotes(event.target.value)} className="w-full" />
          </label>
          <button type="submit" disabled={!props.canSubmitQuickPayment} className="btn btn-primary section-button-md">
            {props.quickPaymentLoading ? 'Registrando...' : 'Registrar pago'}
          </button>
          {canUseStripe ? (
            <div className="section-form" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <strong style={{ fontSize: 13 }}>Stripe</strong>
              <div className="section-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (props.onCreateStripeCheckoutSession) {
                      void props.onCreateStripeCheckoutSession();
                    }
                  }}
                  disabled={stripeLoading || !props.quickPaymentBookingId}
                  className="btn btn-primary section-button-lg"
                >
                  {stripeLoading ? 'Procesando...' : 'Crear checkout Stripe'}
                </button>
                {stripeCheckoutUrl ? (
                  <a href={stripeCheckoutUrl} target="_blank" rel="noreferrer" style={{ alignSelf: 'center', fontSize: 13 }}>
                    Abrir checkout
                  </a>
                ) : null}
              </div>
              <label>
                Stripe sessionId
                <input
                  value={stripeSessionId}
                  onChange={(event) => {
                    if (props.setStripeSessionId) {
                      props.setStripeSessionId(event.target.value);
                    }
                  }}
                  className="w-full"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (props.onConfirmStripeSession) {
                    void props.onConfirmStripeSession();
                  }
                }}
                disabled={stripeLoading || !stripeSessionId.trim()}
                  className="btn btn-ghost section-button-lg"
              >
                Confirmar sesión Stripe
              </button>
            </div>
          ) : null}
          {!props.canSubmitQuickPayment && props.quickPaymentDisabledReason ? (
            <div style={{ color: '#666', fontSize: 12 }}>{props.quickPaymentDisabledReason}</div>
          ) : null}
          {!props.data?.bookings?.length ? <div style={{ color: '#666', fontSize: 12 }}>Primero carga calendario para seleccionar una reserva.</div> : null}
          <Notice tone="error" message={props.quickPaymentError} onClose={() => props.setQuickPaymentError('')} />
          <Notice tone="success" message={props.quickPaymentSuccess} onClose={() => props.setQuickPaymentSuccess('')} />
          <Notice tone="error" message={stripeError} onClose={() => props.setStripeError?.('')} />
          <Notice tone="success" message={stripeSuccess} onClose={() => props.setStripeSuccess?.('')} />
        </form>

        <div className="panel">
          <strong>Historial reciente</strong>
          <Notice tone="error" message={props.paymentsError} onClose={() => props.setPaymentsError('')} />
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {props.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.paidAt ?? payment.createdAt).toLocaleString()}</td>
                    <td>{payment.booking.customerName}</td>
                    <td>{payment.kind}</td>
                    <td>
                      {Number(payment.amount).toFixed(2)} {payment.currency}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          void props.onLoadSaleNote(payment.id);
                        }}
                        disabled={props.saleNoteLoadingId === payment.id}
                        className="btn btn-ghost"
                      >
                        {props.saleNoteLoadingId === payment.id ? 'Cargando...' : 'Nota venta'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!props.payments.length ? (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      Sin pagos registrados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Notice tone="error" message={props.saleNoteError} withMargin onClose={() => props.setSaleNoteError('')} />
      {props.saleNote ? (
        <article className="panel">
          <strong>Nota de venta: {props.saleNote.folio}</strong>
          <div className="section-form" style={{ marginTop: 8, gap: 4 }}>
            <div>Emitida: {new Date(props.saleNote.issuedAt).toLocaleString()}</div>
            <div>Negocio: {props.saleNote.tenant.name}</div>
            <div>
              Cliente: {props.saleNote.booking.customerName} ({props.saleNote.booking.customerEmail})
            </div>
            <div>Servicio: {props.saleNote.booking.serviceName}</div>
            <div>Staff: {props.saleNote.booking.staffName}</div>
            <div>
              Pago: {props.saleNote.payment.amount.toFixed(2)} {props.saleNote.payment.currency} ({props.saleNote.payment.method})
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
