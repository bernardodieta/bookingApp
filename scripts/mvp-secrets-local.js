const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ENV_PATH = path.join(process.cwd(), '.env');
const ENV_EXAMPLE_PATH = path.join(process.cwd(), '.env.example');

const TARGET_KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

function parseArgs() {
  return {
    force: process.argv.includes('--force')
  };
}

function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) {
    return;
  }

  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    throw new Error('No existe .env ni .env.example para inicializar configuración local.');
  }

  fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
}

function generateSecret() {
  return crypto.randomBytes(48).toString('base64url');
}

function shouldReplaceCurrentValue(currentValue, force) {
  if (force) {
    return true;
  }

  const value = (currentValue ?? '').trim();
  if (!value) {
    return true;
  }

  const normalized = value.toLowerCase();
  if (
    normalized.includes('change_me') ||
    normalized.includes('changeme') ||
    normalized === 'secret' ||
    normalized === 'password' ||
    normalized === 'test'
  ) {
    return true;
  }

  return value.length < 32;
}

function upsertEnvLine(lines, key, value) {
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) {
    lines[index] = `${key}=${value}`;
    return;
  }

  lines.push(`${key}=${value}`);
}

function run() {
  const { force } = parseArgs();
  ensureEnvFile();

  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  const currentMap = Object.fromEntries(
    lines
      .filter((line) => line.includes('='))
      .map((line) => {
        const eq = line.indexOf('=');
        return [line.slice(0, eq).trim(), line.slice(eq + 1)];
      })
  );

  let updatedCount = 0;

  for (const key of TARGET_KEYS) {
    const currentValue = currentMap[key];
    if (!shouldReplaceCurrentValue(currentValue, force)) {
      continue;
    }

    upsertEnvLine(lines, key, generateSecret());
    updatedCount += 1;
  }

  if (updatedCount === 0) {
    console.log('No se realizaron cambios: secretos JWT ya parecen seguros. Usa --force para rotar.');
    return;
  }

  fs.writeFileSync(ENV_PATH, `${lines.join('\n').replace(/\n+$/g, '')}\n`, 'utf8');
  console.log(`Se actualizaron ${updatedCount} secreto(s) JWT en .env.`);
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error en qa:secrets:local: ${message}`);
  process.exit(1);
}
