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

function getTargetEnvFileName(target) {
  if (target === 'staging') {
    return '.env.staging';
  }
  if (target === 'prod' || target === 'production') {
    return '.env.prod';
  }
  return '.env';
}

function resolveEnvValues(target) {
  const root = process.cwd();
  const baseEnv = readEnvFile(path.join(root, '.env'));
  const targetEnv = readEnvFile(path.join(root, getTargetEnvFileName(target)));

  return {
    ...baseEnv,
    ...targetEnv,
    ...process.env
  };
}

function hasValue(envValues, name) {
  return typeof envValues[name] === 'string' && envValues[name].trim().length > 0;
}

function getValue(envValues, name) {
  return (envValues[name] ?? '').trim();
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

  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    return 'prod';
  }
  if (nodeEnv === 'staging') {
    return 'staging';
  }
  return 'dev';
}

function parseRuntimeOptions() {
  const failOnWarn = process.argv.includes('--fail-on-warn');
  return { failOnWarn };
}

function pushIssue(issues, level, code, message) {
  issues.push({ level, code, message });
}

function run() {
  const target = parseEnvTarget();
  const runtime = parseRuntimeOptions();
  const envValues = resolveEnvValues(target);
  const issues = [];

  const required = ['NEXT_PUBLIC_API_URL', 'PORT', 'DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  for (const key of required) {
    if (!hasValue(envValues, key)) {
      pushIssue(issues, 'error', 'MISSING_ENV', `Falta variable obligatoria: ${key}`);
    }
  }

  const jwtAccess = getValue(envValues, 'JWT_ACCESS_SECRET');
  const jwtRefresh = getValue(envValues, 'JWT_REFRESH_SECRET');
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

  const apiUrl = getValue(envValues, 'NEXT_PUBLIC_API_URL');
  if (apiUrl) {
    const isHttps = apiUrl.startsWith('https://');
    if ((target === 'staging' || target === 'prod') && !isHttps) {
      pushIssue(issues, target === 'prod' ? 'error' : 'warn', 'NON_HTTPS_API_URL', 'NEXT_PUBLIC_API_URL debería usar HTTPS fuera de dev.');
    }
  }

  const dbUrl = getValue(envValues, 'DATABASE_URL');
  if (dbUrl && (target === 'staging' || target === 'prod')) {
    if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
      pushIssue(issues, target === 'prod' ? 'error' : 'warn', 'LOCAL_DB_URL', 'DATABASE_URL apunta a localhost fuera de dev.');
    }
  }

  const sendgridReady = hasValue(envValues, 'SENDGRID_API_KEY') && hasValue(envValues, 'SENDGRID_FROM_EMAIL');
  const smtpReady =
    hasValue(envValues, 'SMTP_HOST') &&
    hasValue(envValues, 'SMTP_PORT') &&
    (hasValue(envValues, 'SMTP_FROM_EMAIL') || hasValue(envValues, 'SMTP_USER'));

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

  if (errorCount === 0 && runtime.failOnWarn && warnCount > 0) {
    console.error(`❌ Preflight en modo estricto: ${warnCount} warning(s) detectados.`);
    process.exit(1);
  }

  if (errorCount === 0) {
    console.log(`✅ Preflight sin errores bloqueantes (${warnCount} warning(s)).`);
    return;
  }

  console.error(`❌ Preflight con ${errorCount} error(es) y ${warnCount} warning(s).`);
  process.exit(1);
}

run();
