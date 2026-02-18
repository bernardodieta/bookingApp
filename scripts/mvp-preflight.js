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

function loadLocalEnv() {
  const root = process.cwd();
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const parsed = parseDotEnv(fs.readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function hasValue(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim().length > 0;
}

function getValue(name) {
  return (process.env[name] ?? '').trim();
}

function looksDefaultSecret(value) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('change_me') ||
    normalized.includes('changeme') ||
    normalized === 'secret' ||
    normalized === 'password' ||
    normalized === 'test'
  );
}

function parseEnvTarget() {
  const arg = process.argv.find((entry) => entry.startsWith('--env='));
  if (arg) {
    return arg.slice('--env='.length).toLowerCase();
  }

  const nodeEnv = getValue('NODE_ENV').toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    return 'prod';
  }
  if (nodeEnv === 'staging') {
    return 'staging';
  }
  return 'dev';
}

function pushIssue(issues, level, code, message) {
  issues.push({ level, code, message });
}

function run() {
  loadLocalEnv();

  const target = parseEnvTarget();
  const issues = [];

  const required = ['NEXT_PUBLIC_API_URL', 'PORT', 'DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  for (const key of required) {
    if (!hasValue(key)) {
      pushIssue(issues, 'error', 'MISSING_ENV', `Falta variable obligatoria: ${key}`);
    }
  }

  const jwtAccess = getValue('JWT_ACCESS_SECRET');
  const jwtRefresh = getValue('JWT_REFRESH_SECRET');
  if (jwtAccess && looksDefaultSecret(jwtAccess)) {
    pushIssue(
      issues,
      target === 'dev' ? 'warn' : 'error',
      'WEAK_SECRET',
      'JWT_ACCESS_SECRET parece un valor por defecto/débil.'
    );
  }
  if (jwtRefresh && looksDefaultSecret(jwtRefresh)) {
    pushIssue(
      issues,
      target === 'dev' ? 'warn' : 'error',
      'WEAK_SECRET',
      'JWT_REFRESH_SECRET parece un valor por defecto/débil.'
    );
  }

  const apiUrl = getValue('NEXT_PUBLIC_API_URL');
  if (apiUrl) {
    const isHttps = apiUrl.startsWith('https://');
    if ((target === 'staging' || target === 'prod') && !isHttps) {
      pushIssue(issues, target === 'prod' ? 'error' : 'warn', 'NON_HTTPS_API_URL', 'NEXT_PUBLIC_API_URL debería usar HTTPS fuera de dev.');
    }
  }

  const dbUrl = getValue('DATABASE_URL');
  if (dbUrl && (target === 'staging' || target === 'prod')) {
    if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
      pushIssue(issues, target === 'prod' ? 'error' : 'warn', 'LOCAL_DB_URL', 'DATABASE_URL apunta a localhost fuera de dev.');
    }
  }

  const sendgridReady = hasValue('SENDGRID_API_KEY') && hasValue('SENDGRID_FROM_EMAIL');
  const smtpReady = hasValue('SMTP_HOST') && hasValue('SMTP_PORT') && (hasValue('SMTP_FROM_EMAIL') || hasValue('SMTP_USER'));

  if (!sendgridReady && !smtpReady) {
    pushIssue(
      issues,
      target === 'dev' ? 'warn' : 'error',
      'EMAIL_PROVIDER_MISSING',
      'No hay proveedor de email completo (ni SendGrid ni SMTP fallback).'
    );
  }

  const errorCount = issues.filter((entry) => entry.level === 'error').length;
  const warnCount = issues.filter((entry) => entry.level === 'warn').length;

  console.log(`MVP preflight target: ${target}`);
  console.log(`Checks: ${required.length + 5}`);

  for (const issue of issues) {
    const icon = issue.level === 'error' ? '❌' : '⚠️';
    console.log(`${icon} [${issue.code}] ${issue.message}`);
  }

  if (errorCount === 0 && warnCount === 0) {
    console.log('✅ Preflight MVP OK.');
    return;
  }

  if (errorCount === 0) {
    console.log(`✅ Preflight sin errores bloqueantes (${warnCount} warning(s)).`);
    return;
  }

  console.error(`❌ Preflight con ${errorCount} error(es) y ${warnCount} warning(s).`);
  process.exit(1);
}

run();
