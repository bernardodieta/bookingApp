const { spawnSync } = require('node:child_process');

function parseArgs() {
  const args = process.argv.slice(2);
  let envTarget = 'staging';
  let skipMigrate = false;
  let skipSmoke = false;
  let smokeApiUrl = '';
  let strict = false;

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
    }
  }

  if (envTarget !== 'staging' && envTarget !== 'prod') {
    throw new Error('Argumento inválido: --env debe ser staging o prod.');
  }

  return { envTarget, skipMigrate, skipSmoke, smokeApiUrl, strict };
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

function run() {
  const options = parseArgs();
  const preflightScript = options.envTarget === 'staging'
    ? options.strict
      ? 'qa:preflight:staging:strict'
      : 'qa:preflight:staging'
    : options.strict
      ? 'qa:preflight:prod:strict'
      : 'qa:preflight:prod';
  const smokeScript = options.envTarget === 'staging' ? 'qa:smoke:staging' : 'qa:smoke:prod';

  console.log(`[MVP-GATE] entorno=${options.envTarget} strict=${options.strict ? 'on' : 'off'}`);

  runCommand('npm', ['run', preflightScript], 'PREFLIGHT');

  if (!options.skipMigrate) {
    runCommand('npm', ['run', 'prisma:deploy', '-w', '@apoint/api'], 'MIGRATE');
  } else {
    console.log('\n[MIGRATE] omitido por --skip-migrate');
  }

  if (!options.skipSmoke) {
    if (options.smokeApiUrl) {
      runCommand(
        'node',
        ['scripts/mvp-go-live-smoke.js', `--env=${options.envTarget}`, `--api-url=${options.smokeApiUrl}`],
        'SMOKE_OVERRIDE_URL'
      );
    } else {
      runCommand('npm', ['run', smokeScript], 'SMOKE');
    }
  } else {
    console.log('\n[SMOKE] omitido por --skip-smoke');
  }

  console.log('\n✅ MVP gate completado correctamente.');
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ MVP gate falló: ${message}`);
  process.exit(1);
}
