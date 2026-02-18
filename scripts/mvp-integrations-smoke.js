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
  let apiUrl = (process.env.npm_config_api_url ?? '').trim();
  let conflictId = (process.env.npm_config_conflict_id ?? '').trim();
  let exerciseResolve = false;

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      envTarget = arg.slice('--env='.length).trim().toLowerCase() || 'dev';
      continue;
    }

    if (arg.startsWith('--api-url=')) {
      apiUrl = arg.slice('--api-url='.length).trim();
      continue;
    }

    if (arg.startsWith('--conflict-id=')) {
      conflictId = arg.slice('--conflict-id='.length).trim();
      continue;
    }

    if (arg === '--exercise-resolve') {
      exerciseResolve = true;
    }
  }

  return {
    envTarget,
    apiUrl,
    conflictId,
    exerciseResolve
  };
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
      throw new Error('Falta STAGING_API_URL para qa:smoke:integrations en staging.');
    }
    return staging;
  }

  if (options.envTarget === 'prod' || options.envTarget === 'production') {
    const prod = (envValues.PROD_API_URL ?? '').trim();
    if (!prod) {
      throw new Error('Falta PROD_API_URL para qa:smoke:integrations en prod.');
    }
    return prod;
  }

  return (envValues.API_URL ?? 'http://localhost:3001').trim();
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
  console.log(`[INTEGRATIONS-SMOKE][${step}] ${message}`);
}

async function createTenantAndAuth(apiBase, runTag) {
  const ownerEmail = `owner.integrations.${runTag}@example.com`;
  const staffEmail = `staff.integrations.${runTag}@example.com`;

  const register = await apiRequest(apiBase, '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantName: `Integrations Smoke ${runTag}`,
      email: ownerEmail,
      password: 'Password123'
    })
  });
  assertStatus('AUTH_REGISTER', register.response, 201, register.payload);

  const token = register.payload?.accessToken;
  if (!token) {
    throw new Error('[AUTH_REGISTER] respuesta sin accessToken.');
  }

  const staff = await apiRequest(apiBase, '/staff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      fullName: `Staff Integrations ${runTag}`,
      email: staffEmail
    })
  });
  assertStatus('CREATE_STAFF', staff.response, 201, staff.payload);

  return {
    token,
    staffId: staff.payload.id
  };
}

async function run() {
  const options = parseArgs();
  const envValues = resolveEnvValues(options.envTarget);
  const apiBase = resolveApiBase(options, envValues);
  const runTag = Date.now().toString();

  logStep('START', `ENV=${options.envTarget} API=${apiBase} RESOLVE=${options.exerciseResolve ? 'on' : 'off'}`);

  const auth = await createTenantAndAuth(apiBase, runTag);
  const headers = {
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json'
  };

  const metrics = await apiRequest(apiBase, '/integrations/calendar/metrics?windowDays=7', {
    method: 'GET',
    headers
  });
  assertStatus('METRICS', metrics.response, 200, metrics.payload);
  logStep('METRICS', `queuePending=${metrics.payload?.queue?.pending ?? 'n/a'} conflicts=${metrics.payload?.incidents?.conflicts ?? 'n/a'}`);

  const accounts = await apiRequest(apiBase, '/integrations/calendar/accounts', {
    method: 'GET',
    headers
  });
  assertStatus('ACCOUNTS', accounts.response, 200, accounts.payload);
  logStep('ACCOUNTS', `items=${Array.isArray(accounts.payload) ? accounts.payload.length : 0}`);

  const conflicts = await apiRequest(apiBase, '/integrations/calendar/conflicts?limit=20', {
    method: 'GET',
    headers
  });
  assertStatus('CONFLICTS', conflicts.response, 200, conflicts.payload);

  const conflictItems = Array.isArray(conflicts.payload?.items) ? conflicts.payload.items : [];
  const unresolved = conflictItems.find((entry) => !entry.resolved);
  const targetConflictId = options.conflictId || unresolved?.id || conflictItems[0]?.id;

  if (targetConflictId) {
    const preview = await apiRequest(apiBase, `/integrations/calendar/conflicts/${targetConflictId}/preview`, {
      method: 'GET',
      headers
    });
    assertStatus('CONFLICT_PREVIEW', preview.response, 200, preview.payload);
    logStep('CONFLICT_PREVIEW', `id=${targetConflictId} suggested=${preview.payload?.suggestedAction ?? 'n/a'}`);

    if (options.exerciseResolve) {
      const resolve = await apiRequest(apiBase, `/integrations/calendar/conflicts/${targetConflictId}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'dismiss',
          note: `Smoke resolve ${runTag}`
        })
      });
      assertStatus('CONFLICT_RESOLVE', resolve.response, 201, resolve.payload);
      logStep('CONFLICT_RESOLVE', `id=${targetConflictId} action=dismiss`);
    } else {
      logStep('CONFLICT_RESOLVE', 'omitido (ejecuta con --exercise-resolve para probar resolución).');
    }
  } else {
    logStep('CONFLICT_PREVIEW', 'sin conflictos disponibles en este tenant smoke (ok).');
  }

  const googleAuthorize = await apiRequest(apiBase, '/integrations/calendar/google/authorize', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      staffId: auth.staffId
    })
  });

  if (googleAuthorize.response.status === 200) {
    logStep('GOOGLE_AUTHORIZE', 'authorizeUrl generado correctamente.');
  } else if (googleAuthorize.response.status === 400) {
    logStep('GOOGLE_AUTHORIZE', 'omitido por configuración OAuth faltante (esperado en local).');
  } else {
    assertStatus('GOOGLE_AUTHORIZE', googleAuthorize.response, 200, googleAuthorize.payload);
  }

  const msAuthorize = await apiRequest(apiBase, '/integrations/calendar/microsoft/authorize', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      staffId: auth.staffId
    })
  });

  if (msAuthorize.response.status === 200) {
    logStep('MICROSOFT_AUTHORIZE', 'authorizeUrl generado correctamente.');
  } else if (msAuthorize.response.status === 400) {
    logStep('MICROSOFT_AUTHORIZE', 'omitido por configuración OAuth faltante (esperado en local).');
  } else {
    assertStatus('MICROSOFT_AUTHORIZE', msAuthorize.response, 200, msAuthorize.payload);
  }

  console.log('');
  console.log('✅ Integrations smoke completado correctamente.');
  console.log(`Tenant run tag: ${runTag}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Integrations smoke falló: ${message}`);
  process.exit(1);
});
