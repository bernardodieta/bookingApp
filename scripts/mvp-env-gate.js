const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function parseArgs() {
  const args = process.argv.slice(2);
  let envTarget = 'staging';
  let skipMigrate = false;
  let skipSmoke = false;
  let smokeApiUrl = '';
  let strict = false;
  let allowPlaceholderEnv = false;

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      envTarget = arg.slice('--env='.length).trim().toLowerCase();
    } else if (arg === '--skip-migrate') {
      skipMigrate = true;
    } else if (arg === '--skip-smoke') {
      skipSmoke = true;
    } else if (arg.startsWith('--smoke-api-url=')) {
      smokeApiUrl = arg.slice('--smoke-api-url='.length).trim();
    } else if (arg === '--strict') {
      strict = true;
    } else if (arg === '--allow-placeholder-env') {
      allowPlaceholderEnv = true;
    }
  }

  if (envTarget !== 'staging' && envTarget !== 'prod') {
    throw new Error('Argumento inválido: --env debe ser staging o prod.');
  }

  return { envTarget, skipMigrate, skipSmoke, smokeApiUrl, strict, allowPlaceholderEnv };
}

function runCommand(command, args, label, extraEnv) {
  console.log(`\n[${label}] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ...(extraEnv ?? {})
    }
  });

  if (result.status !== 0) {
    throw new Error(`[${label}] falló con exit code ${result.status ?? 'desconocido'}.`);
  }
}

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

function resolveGateEnv(target) {
  const root = process.cwd();
  const baseEnv = readEnvFile(path.join(root, '.env'));
  const targetEnv = readEnvFile(path.join(root, getTargetEnvFileName(target)));

  return {
    ...baseEnv,
    ...targetEnv,
    ...process.env
  };
}

async function ensureSmokeApiReachable(smokeApiUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(smokeApiUrl);
  } catch {
    throw new Error(`[SMOKE_OVERRIDE_URL] URL inválida: ${smokeApiUrl}`);
  }

  const healthUrl = new URL('/health', parsedUrl).toString();
  try {
    const response = await fetch(healthUrl);
    if (!response.ok) {
      const body = await response.text();
      const diagnostic = `[SMOKE_HEALTH] status=${response.status} body=${body}`;
      throw new Error(diagnostic);
    }
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    const suffix = diagnostic ? ` Detalle: ${diagnostic}` : '';
    throw new Error(
      `[SMOKE_OVERRIDE_URL] API no alcanzable en ${healthUrl}. ` +
      `Levanta la API primero (ej. npm run start:dev -w @apoint/api).${suffix}`
    );
  }
}

async function run() {
  const options = parseArgs();
  const gateEnv = resolveGateEnv(options.envTarget);
  const preflightScript = options.envTarget === 'staging'
    ? options.strict
      ? 'qa:preflight:staging:strict'
      : 'qa:preflight:staging'
    : options.strict
      ? 'qa:preflight:prod:strict'
      : 'qa:preflight:prod';
  const smokeScript = options.envTarget === 'staging' ? 'qa:smoke:staging' : 'qa:smoke:prod';

  console.log(`[MVP-GATE] entorno=${options.envTarget} strict=${options.strict ? 'on' : 'off'}`);

  const preflightArgs = ['run', preflightScript];
  if (options.allowPlaceholderEnv) {
    preflightArgs.push('--', '--allow-placeholder-env');
  }

  runCommand('npm', preflightArgs, 'PREFLIGHT', gateEnv);

  if (!options.skipMigrate) {
    runCommand('npm', ['run', 'prisma:deploy', '-w', '@apoint/api'], 'MIGRATE', gateEnv);
  } else {
    console.log('\n[MIGRATE] omitido por --skip-migrate');
  }

  if (!options.skipSmoke) {
    if (options.smokeApiUrl) {
      await ensureSmokeApiReachable(options.smokeApiUrl);
      runCommand(
        'node',
        ['scripts/mvp-go-live-smoke.js', `--env=${options.envTarget}`, `--api-url=${options.smokeApiUrl}`],
        'SMOKE_OVERRIDE_URL',
        gateEnv
      );
    } else {
      runCommand('npm', ['run', smokeScript], 'SMOKE', gateEnv);
    }
  } else {
    console.log('\n[SMOKE] omitido por --skip-smoke');
  }

  console.log('\n✅ MVP gate completado correctamente.');
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ MVP gate falló: ${message}`);
  process.exit(1);
});
