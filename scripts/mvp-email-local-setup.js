const fs = require('node:fs');
const path = require('node:path');

const ENV_PATH = path.join(process.cwd(), '.env');
const ENV_EXAMPLE_PATH = path.join(process.cwd(), '.env.example');

function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) {
    return;
  }

  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    throw new Error('No existe .env ni .env.example para inicializar configuración local.');
  }

  fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
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
  ensureEnvFile();

  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  upsertEnvLine(lines, 'SENDGRID_API_KEY', '');
  upsertEnvLine(lines, 'SMTP_HOST', 'localhost');
  upsertEnvLine(lines, 'SMTP_PORT', '1025');
  upsertEnvLine(lines, 'SMTP_SECURE', 'false');
  upsertEnvLine(lines, 'SMTP_USER', '');
  upsertEnvLine(lines, 'SMTP_PASS', '');
  upsertEnvLine(lines, 'SMTP_FROM_EMAIL', 'no-reply@apoint.local');
  upsertEnvLine(lines, 'NOTIFICATIONS_BUSINESS_EMAIL', 'owner@apoint.local');

  fs.writeFileSync(ENV_PATH, `${lines.join('\n').replace(/\n+$/g, '')}\n`, 'utf8');

  console.log('Configuración de email local aplicada en .env (SMTP Mailpit).');
  console.log('Siguiente paso: docker compose up -d mailpit');
  console.log('Bandeja local: http://localhost:8025');
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error en qa:email:local: ${message}`);
  process.exit(1);
}
