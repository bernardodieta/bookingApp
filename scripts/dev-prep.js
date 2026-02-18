const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const targets = ['apps/web/.next', 'apps/api/dist'];

for (const target of targets) {
  const fullPath = path.resolve(process.cwd(), target);
  try {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`[dev:prep] cleaned ${target}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[dev:prep] skipped ${target}: ${message}`);
  }
}

function loadRootEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    process.env[key] = value;
  }
}

function runPrismaMigrateDeploy() {
  loadRootEnv();

  if (!process.env.DATABASE_URL) {
    console.warn('[dev:prep] skipped prisma migrate deploy: DATABASE_URL missing');
    return;
  }

  console.log('[dev:prep] applying prisma migrations');
  const result = spawnSync('npm', ['run', 'prisma:deploy', '-w', '@apoint/api'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runPrismaMigrateDeploy();
