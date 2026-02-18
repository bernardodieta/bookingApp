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
  let idToken = (process.env.npm_config_id_token ?? '').trim();

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      envTarget = arg.slice('--env='.length).trim().toLowerCase() || 'dev';
    }
    if (arg.startsWith('--api-url=')) {
      apiUrl = arg.slice('--api-url='.length).trim();
    }
    if (arg.startsWith('--id-token=')) {
      idToken = arg.slice('--id-token='.length).trim();
    }
  }

  return { envTarget, apiUrl, idToken };
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
      throw new Error('Falta STAGING_API_URL para qa:smoke:partner-google en staging.');
    }
    return staging;
  }

  if (options.envTarget === 'prod' || options.envTarget === 'production') {
    const prod = (envValues.PROD_API_URL ?? '').trim();
    if (!prod) {
      throw new Error('Falta PROD_API_URL para qa:smoke:partner-google en prod.');
    }
    return prod;
  }

  return (envValues.API_URL ?? 'http://localhost:3001').trim();
}

function parseJwtPayload(jwtToken) {
  const parts = jwtToken.split('.');
  if (parts.length < 2) {
    throw new Error('idToken inválido: formato JWT incompleto.');
  }

  const payloadSegment = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padding = payloadSegment.length % 4;
  const normalized = padding === 0 ? payloadSegment : payloadSegment + '='.repeat(4 - padding);

  let payload;
  try {
    payload = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch {
    throw new Error('idToken inválido: no se pudo leer payload JSON.');
  }

  return payload;
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
  console.log(`[PARTNER-GOOGLE-SMOKE][${step}] ${message}`);
}

async function ensurePartnerAccount(apiBase, email) {
  const tenantSeed = Date.now().toString();
  const register = await apiRequest(apiBase, '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantName: `Partner Google ${tenantSeed}`,
      email,
      password: 'Password123'
    })
  });

  if (register.response.status === 201) {
    logStep('AUTH_REGISTER', `Cuenta partner preparada para ${email}`);
    return;
  }

  if (register.response.status === 400) {
    logStep('AUTH_REGISTER', `Cuenta partner ya existía para ${email}, se reutiliza.`);
    return;
  }

  throw new Error(
    `[AUTH_REGISTER] esperado 201/400, recibido ${register.response.status}. payload=${JSON.stringify(register.payload)}`
  );
}

async function run() {
  const options = parseArgs();
  const envValues = resolveEnvValues(options.envTarget);
  const apiBase = resolveApiBase(options, envValues);

  const idToken = options.idToken || (envValues.GOOGLE_ID_TOKEN ?? '').trim();
  if (!idToken) {
    throw new Error('Falta idToken. Pásalo con --id-token=... o define GOOGLE_ID_TOKEN en entorno.');
  }

  const payload = parseJwtPayload(idToken);
  const googleEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!googleEmail) {
    throw new Error('El idToken no contiene email en el payload.');
  }

  logStep('START', `ENV=${options.envTarget} API=${apiBase} EMAIL=${googleEmail}`);

  await ensurePartnerAccount(apiBase, googleEmail);

  const googleLogin = await apiRequest(apiBase, '/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  assertStatus('AUTH_GOOGLE', googleLogin.response, 201, googleLogin.payload);

  const accessToken = googleLogin.payload?.accessToken;
  if (!accessToken) {
    throw new Error('[AUTH_GOOGLE] respuesta sin accessToken.');
  }

  const me = await apiRequest(apiBase, '/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  assertStatus('AUTH_ME', me.response, 200, me.payload);

  if (String(me.payload?.email ?? '').toLowerCase() !== googleEmail) {
    throw new Error(`[AUTH_ME] email inesperado. esperado=${googleEmail} recibido=${me.payload?.email}`);
  }

  console.log('');
  console.log('✅ Partner Google SSO smoke completado correctamente.');
  console.log(`Partner email: ${googleEmail}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Partner Google SSO smoke falló: ${message}`);
  process.exit(1);
});
