const fs = require('node:fs');
const path = require('node:path');
const Stripe = require('stripe');

function parseDotEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return parseDotEnv(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs() {
  const args = process.argv.slice(2);
  let envTarget = 'dev';
  let apiUrl = '';

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      envTarget = arg.slice('--env='.length).trim().toLowerCase() || 'dev';
    }
    if (arg.startsWith('--api-url=')) {
      apiUrl = arg.slice('--api-url='.length).trim();
    }
  }

  return { envTarget, apiUrl };
}

function resolveEnvValues(target) {
  const root = process.cwd();
  const base = readEnvFile(path.join(root, '.env'));
  const targetFile =
    target === 'staging' ? '.env.staging' : target === 'prod' || target === 'production' ? '.env.prod' : '.env';
  const scoped = readEnvFile(path.join(root, targetFile));

  return {
    ...base,
    ...scoped,
    ...process.env
  };
}

function resolveApiBase(options, envValues) {
  if (options.apiUrl) {
    return options.apiUrl;
  }

  if (options.envTarget === 'staging') {
    const staging = (envValues.STAGING_API_URL ?? '').trim();
    if (!staging) {
      throw new Error('Falta STAGING_API_URL para qa:smoke:stripe en staging.');
    }
    return staging;
  }

  if (options.envTarget === 'prod' || options.envTarget === 'production') {
    const prod = (envValues.PROD_API_URL ?? '').trim();
    if (!prod) {
      throw new Error('Falta PROD_API_URL para qa:smoke:stripe en prod.');
    }
    return prod;
  }

  return (envValues.API_URL ?? 'http://localhost:3001').trim();
}

function requireEnv(envValues, key, context) {
  const value = (envValues[key] ?? '').trim();
  if (!value) {
    throw new Error(`Falta ${key} para ${context}.`);
  }
  return value;
}

function nextWeekdayUtc(targetDay, hour = 10, minute = 0) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
  const currentDay = base.getUTCDay();

  let delta = targetDay - currentDay;
  if (delta < 0) {
    delta += 7;
  }
  if (delta === 0 && base <= now) {
    delta = 7;
  }

  base.setUTCDate(base.getUTCDate() + delta);
  return base;
}

async function apiRequest(apiBase, routePath, options = {}) {
  const response = await fetch(new URL(routePath, apiBase), options);
  const text = await response.text();

  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  return { response, payload };
}

function assertStatus(step, response, expected, payload) {
  if (response.status !== expected) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`[${step}] esperado ${expected}, recibido ${response.status}. payload=${detail}`);
  }
}

function logStep(step, message) {
  console.log(`[STRIPE-SMOKE][${step}] ${message}`);
}

async function run() {
  const options = parseArgs();
  const envValues = resolveEnvValues(options.envTarget);
  const apiBase = resolveApiBase(options, envValues);

  requireEnv(envValues, 'STRIPE_SECRET_KEY', 'qa:smoke:stripe');
  const stripeWebhookSecret = requireEnv(envValues, 'STRIPE_WEBHOOK_SECRET', 'qa:smoke:stripe');

  const runTag = `${Date.now()}`;
  const ownerEmail = `owner.stripe.${runTag}@example.com`;
  const staffEmail = `staff.stripe.${runTag}@example.com`;

  logStep('START', `ENV=${options.envTarget} API=${apiBase}`);

  const register = await apiRequest(apiBase, '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantName: `Stripe Smoke ${runTag}`,
      email: ownerEmail,
      password: 'Password123'
    })
  });
  assertStatus('AUTH_REGISTER', register.response, 201, register.payload);
  const token = register.payload?.accessToken;
  const tenantId = register.payload?.user?.tenantId;
  if (!token || !tenantId) {
    throw new Error('[AUTH_REGISTER] respuesta sin accessToken o tenantId.');
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  const tenant = await apiRequest(apiBase, '/tenant/settings', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assertStatus('TENANT_SETTINGS', tenant.response, 200, tenant.payload);

  const service = await apiRequest(apiBase, '/services', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `Servicio Stripe ${runTag}`,
      durationMinutes: 30,
      price: 199
    })
  });
  assertStatus('CREATE_SERVICE', service.response, 201, service.payload);

  const staff = await apiRequest(apiBase, '/staff', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fullName: `Staff Stripe ${runTag}`,
      email: staffEmail
    })
  });
  assertStatus('CREATE_STAFF', staff.response, 201, staff.payload);

  const bookingStart = nextWeekdayUtc(1, 11, 0);
  const availabilityRule = await apiRequest(apiBase, '/availability/rules', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      dayOfWeek: bookingStart.getUTCDay(),
      startTime: '08:00',
      endTime: '20:00',
      staffId: staff.payload.id
    })
  });
  assertStatus('CREATE_AVAILABILITY_RULE', availabilityRule.response, 201, availabilityRule.payload);

  const booking = await apiRequest(apiBase, '/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      serviceId: service.payload.id,
      staffId: staff.payload.id,
      startAt: bookingStart.toISOString(),
      customerName: 'Cliente Stripe Smoke',
      customerEmail: `customer.stripe.${runTag}@example.com`
    })
  });
  assertStatus('CREATE_BOOKING', booking.response, 201, booking.payload);
  const bookingId = booking.payload?.id;
  if (!bookingId) {
    throw new Error('[CREATE_BOOKING] respuesta sin booking id.');
  }

  const checkout = await apiRequest(apiBase, '/payments/stripe/checkout-session', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      bookingId,
      mode: 'deposit',
      amount: 50
    })
  });
  assertStatus('CREATE_STRIPE_CHECKOUT', checkout.response, 201, checkout.payload);
  const sessionId = checkout.payload?.sessionId;
  if (!sessionId) {
    throw new Error('[CREATE_STRIPE_CHECKOUT] respuesta sin sessionId.');
  }

  const eventPayload = {
    id: `evt_${runTag}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: 5000,
        currency: 'mxn',
        metadata: {
          tenantId,
          bookingId,
          mode: 'deposit'
        }
      }
    }
  };

  const payloadString = JSON.stringify(eventPayload);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret: stripeWebhookSecret
  });

  const webhook1 = await apiRequest(apiBase, '/payments/stripe/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature
    },
    body: payloadString
  });
  assertStatus('STRIPE_WEBHOOK_FIRST', webhook1.response, 200, webhook1.payload);

  const webhook2 = await apiRequest(apiBase, '/payments/stripe/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature
    },
    body: payloadString
  });
  assertStatus('STRIPE_WEBHOOK_DUPLICATE', webhook2.response, 200, webhook2.payload);

  const paymentsList = await apiRequest(apiBase, `/payments?bookingId=${encodeURIComponent(bookingId)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  assertStatus('PAYMENTS_LIST', paymentsList.response, 200, paymentsList.payload);

  const stripePayments = Array.isArray(paymentsList.payload)
    ? paymentsList.payload.filter(
        (payment) => payment?.provider === 'stripe' && payment?.providerReference === sessionId && payment?.status === 'paid'
      )
    : [];

  if (stripePayments.length !== 1) {
    throw new Error(`[PAYMENTS_ASSERT] Se esperaba 1 pago stripe idempotente y se obtuvieron ${stripePayments.length}.`);
  }

  console.log('');
  console.log('✅ Stripe smoke completado correctamente.');
  console.log(`Booking: ${bookingId}`);
  console.log(`Stripe session: ${sessionId}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Stripe smoke falló: ${message}`);
  process.exit(1);
});
