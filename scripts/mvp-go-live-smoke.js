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

  return {
    envTarget,
    apiUrl
  };
}

function resolveApiBase(options) {
  if (options.apiUrl) {
    return options.apiUrl;
  }

  if (options.envTarget === 'staging') {
    const staging = (process.env.STAGING_API_URL ?? '').trim();
    if (!staging) {
      throw new Error('Falta STAGING_API_URL para ejecutar smoke en staging.');
    }
    return staging;
  }

  if (options.envTarget === 'prod' || options.envTarget === 'production') {
    const prod = (process.env.PROD_API_URL ?? '').trim();
    if (!prod) {
      throw new Error('Falta PROD_API_URL para ejecutar smoke en prod.');
    }
    return prod;
  }

  return process.env.API_URL ?? 'http://localhost:3001';
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

async function apiRequest(apiBase, path, options = {}) {
  const response = await fetch(new URL(path, apiBase), options);
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, payload };
}

function assertStatus(response, expected, stepName, payload) {
  if (response.status !== expected) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`[${stepName}] esperado ${expected}, recibido ${response.status}. payload=${detail}`);
  }
}

function logStep(step, message) {
  console.log(`[MVP-SMOKE][${step}] ${message}`);
}

async function run() {
  const options = parseArgs();
  const apiBase = resolveApiBase(options);
  const runTag = `${Date.now()}`;
  const ownerEmail = `owner.smoke.${runTag}@example.com`;
  const staffEmail = `staff.smoke.${runTag}@example.com`;
  const customerEmail = `customer.smoke.${runTag}@example.com`;

  logStep('START', `ENV=${options.envTarget} API=${apiBase}`);

  const register = await apiRequest(apiBase, '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantName: `Smoke Tenant ${runTag}`,
      email: ownerEmail,
      password: 'Password123'
    })
  });
  assertStatus(register.response, 201, 'AUTH_REGISTER', register.payload);
  const token = register.payload?.accessToken;
  if (!token) {
    throw new Error('[AUTH_REGISTER] respuesta sin accessToken.');
  }
  logStep('AUTH_REGISTER', 'ok');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  const tenantSettings = await apiRequest(apiBase, '/tenant/settings', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  assertStatus(tenantSettings.response, 200, 'TENANT_SETTINGS_GET', tenantSettings.payload);
  const slug = tenantSettings.payload?.slug;
  if (!slug) {
    throw new Error('[TENANT_SETTINGS_GET] respuesta sin slug.');
  }
  logStep('TENANT_SETTINGS_GET', `slug=${slug}`);

  const service = await apiRequest(apiBase, '/services', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `Consulta Smoke ${runTag}`,
      durationMinutes: 30,
      price: 100
    })
  });
  assertStatus(service.response, 201, 'CREATE_SERVICE', service.payload);
  logStep('CREATE_SERVICE', `id=${service.payload.id}`);

  const staff = await apiRequest(apiBase, '/staff', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fullName: `Profesional Smoke ${runTag}`,
      email: staffEmail
    })
  });
  assertStatus(staff.response, 201, 'CREATE_STAFF', staff.payload);
  logStep('CREATE_STAFF', `id=${staff.payload.id}`);

  const bookingStart = nextWeekdayUtc(1, 10, 0);
  const dayOfWeek = bookingStart.getUTCDay();

  const availability = await apiRequest(apiBase, '/availability/rules', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      dayOfWeek,
      startTime: '08:00',
      endTime: '20:00',
      staffId: staff.payload.id
    })
  });
  assertStatus(availability.response, 201, 'CREATE_AVAILABILITY_RULE', availability.payload);
  logStep('CREATE_AVAILABILITY_RULE', 'ok');

  const configuredFields = [
    { key: 'phone', label: 'Teléfono', type: 'tel', required: true },
    { key: 'dni', label: 'DNI', type: 'text', required: false }
  ];

  const patchSettings = await apiRequest(apiBase, '/tenant/settings', {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ bookingFormFields: configuredFields })
  });
  assertStatus(patchSettings.response, 200, 'TENANT_SETTINGS_PATCH', patchSettings.payload);
  logStep('TENANT_SETTINGS_PATCH', 'ok');

  const publicForm = await apiRequest(apiBase, `/public/${slug}/form`);
  assertStatus(publicForm.response, 200, 'PUBLIC_FORM_GET', publicForm.payload);
  const fields = publicForm.payload?.fields;
  if (!Array.isArray(fields) || fields.length < 1) {
    throw new Error('[PUBLIC_FORM_GET] fields inválidos o vacíos.');
  }
  logStep('PUBLIC_FORM_GET', `fields=${fields.length}`);

  const missingRequiredBooking = await apiRequest(apiBase, `/public/${slug}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceId: service.payload.id,
      staffId: staff.payload.id,
      startAt: bookingStart.toISOString(),
      customerName: 'Cliente Smoke Missing',
      customerEmail,
      customFields: {}
    })
  });
  assertStatus(missingRequiredBooking.response, 400, 'PUBLIC_BOOKING_REQUIRED_VALIDATION', missingRequiredBooking.payload);
  logStep('PUBLIC_BOOKING_REQUIRED_VALIDATION', 'ok');

  const createBooking = await apiRequest(apiBase, `/public/${slug}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceId: service.payload.id,
      staffId: staff.payload.id,
      startAt: bookingStart.toISOString(),
      customerName: 'Cliente Smoke OK',
      customerEmail,
      customFields: {
        phone: '+52 555 123 0000',
        dni: 'SMOKE-123'
      }
    })
  });
  assertStatus(createBooking.response, 201, 'PUBLIC_BOOKING_CREATE', createBooking.payload);
  logStep('PUBLIC_BOOKING_CREATE', createBooking.payload?.waitlisted ? 'waitlisted=true' : `bookingId=${createBooking.payload?.id}`);

  console.log('');
  console.log('✅ MVP smoke completado correctamente.');
  console.log(`Tenant slug: ${slug}`);
  console.log(`Owner email: ${ownerEmail}`);
  console.log(`Staff email: ${staffEmail}`);
  console.log(`Customer email: ${customerEmail}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('❌ MVP smoke falló:', message);
  process.exit(1);
});
