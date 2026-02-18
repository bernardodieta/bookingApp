const fs = require('node:fs');
const path = require('node:path');

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
      throw new Error('Falta STAGING_API_URL para qa:smoke:email en staging.');
    }
    return staging;
  }

  if (options.envTarget === 'prod' || options.envTarget === 'production') {
    const prod = (envValues.PROD_API_URL ?? '').trim();
    if (!prod) {
      throw new Error('Falta PROD_API_URL para qa:smoke:email en prod.');
    }
    return prod;
  }

  return (envValues.API_URL ?? 'http://localhost:3001').trim();
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
  console.log(`[EMAIL-SMOKE][${step}] ${message}`);
}

async function run() {
  const options = parseArgs();
  const envValues = resolveEnvValues(options.envTarget);
  const apiBase = resolveApiBase(options, envValues);

  const runTag = `${Date.now()}`;
  const ownerEmail = `owner.mail.${runTag}@example.com`;
  const staffEmail = `staff.mail.${runTag}@example.com`;
  const bookingCustomerEmail = `book.mail.${runTag}@example.com`;
  const waitlistCustomerEmail = `wait.mail.${runTag}@example.com`;

  logStep('START', `ENV=${options.envTarget} API=${apiBase}`);

  const register = await apiRequest(apiBase, '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantName: `Mail Flow ${runTag}`,
      email: ownerEmail,
      password: 'Password123'
    })
  });
  assertStatus('AUTH_REGISTER', register.response, 201, register.payload);
  const token = register.payload?.accessToken;
  if (!token) {
    throw new Error('[AUTH_REGISTER] respuesta sin accessToken.');
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  const tenant = await apiRequest(apiBase, '/tenant/settings', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assertStatus('TENANT_SETTINGS', tenant.response, 200, tenant.payload);
  const slug = tenant.payload?.slug;
  if (!slug) {
    throw new Error('[TENANT_SETTINGS] respuesta sin slug.');
  }
  logStep('TENANT_SETTINGS', `slug=${slug}`);

  const service = await apiRequest(apiBase, '/services', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `Servicio Mail ${runTag}`,
      durationMinutes: 30,
      price: 150
    })
  });
  assertStatus('CREATE_SERVICE', service.response, 201, service.payload);

  const staff = await apiRequest(apiBase, '/staff', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fullName: `Staff Mail ${runTag}`,
      email: staffEmail
    })
  });
  assertStatus('CREATE_STAFF', staff.response, 201, staff.payload);

  const bookingStart = nextWeekdayUtc(1, 10, 0);
  const dayOfWeek = bookingStart.getUTCDay();

  const availabilityRule = await apiRequest(apiBase, '/availability/rules', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      dayOfWeek,
      startTime: '08:00',
      endTime: '20:00',
      staffId: staff.payload.id
    })
  });
  assertStatus('CREATE_AVAILABILITY_RULE', availabilityRule.response, 201, availabilityRule.payload);

  const booking = await apiRequest(apiBase, `/public/${slug}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceId: service.payload.id,
      staffId: staff.payload.id,
      startAt: bookingStart.toISOString(),
      customerName: 'Cliente Booking',
      customerEmail: bookingCustomerEmail
    })
  });
  assertStatus('PUBLIC_BOOKING_CREATE', booking.response, 201, booking.payload);
  if (!booking.payload?.id) {
    throw new Error('[PUBLIC_BOOKING_CREATE] respuesta sin booking id.');
  }

  const waitlist = await apiRequest(apiBase, `/public/${slug}/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceId: service.payload.id,
      staffId: staff.payload.id,
      preferredStartAt: bookingStart.toISOString(),
      customerName: 'Cliente Waitlist',
      customerEmail: waitlistCustomerEmail
    })
  });
  assertStatus('PUBLIC_WAITLIST', waitlist.response, 201, waitlist.payload);

  const customerPortalRegister = await apiRequest(apiBase, `/public/${slug}/customer-portal/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cliente Waitlist',
      email: waitlistCustomerEmail,
      password: 'Password123'
    })
  });
  assertStatus('PORTAL_REGISTER', customerPortalRegister.response, 201, customerPortalRegister.payload);
  const customerToken = customerPortalRegister.payload?.accessToken;
  if (!customerToken) {
    throw new Error('[PORTAL_REGISTER] respuesta sin accessToken.');
  }

  const claimRequest = await apiRequest(apiBase, `/public/${slug}/customer-portal/claim/request`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${customerToken}`
    }
  });
  assertStatus('CLAIM_REQUEST', claimRequest.response, 201, claimRequest.payload);

  const cancelBooking = await apiRequest(apiBase, `/bookings/${booking.payload.id}/cancel`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ reason: 'Email smoke test' })
  });
  assertStatus('BOOKING_CANCEL', cancelBooking.response, 200, cancelBooking.payload);

  console.log('');
  console.log('✅ Email smoke completado correctamente.');
  console.log(`Tenant slug: ${slug}`);
  console.log(`Waitlist customer email: ${waitlistCustomerEmail}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Email smoke falló: ${message}`);
  process.exit(1);
});
