const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseArgs() {
  const args = process.argv.slice(2);
  let env = (process.env.npm_config_env ?? '').trim().toLowerCase() || 'staging';
  let mode = (process.env.npm_config_mode ?? '').trim().toLowerCase() || 'widget';
  let scope = (process.env.npm_config_scope ?? '').trim().toLowerCase() || 'local';
  let apiUrl = (process.env.npm_config_api_url ?? '').trim() || 'http://localhost:3001';
  let tenantSlug = (process.env.npm_config_tenant_slug ?? '').trim();
  let tenantDomain = (process.env.npm_config_tenant_domain ?? '').trim();
  let failfast = (process.env.npm_config_failfast ?? '').trim().toLowerCase() === 'true';

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      env = arg.slice('--env='.length).trim().toLowerCase() || env;
    } else if (arg.startsWith('--mode=')) {
      mode = arg.slice('--mode='.length).trim().toLowerCase() || mode;
    } else if (arg.startsWith('--scope=')) {
      scope = arg.slice('--scope='.length).trim().toLowerCase() || scope;
    } else if (arg.startsWith('--api-url=')) {
      apiUrl = arg.slice('--api-url='.length).trim() || apiUrl;
    } else if (arg.startsWith('--tenant-slug=')) {
      tenantSlug = arg.slice('--tenant-slug='.length).trim() || tenantSlug;
    } else if (arg.startsWith('--tenant-domain=')) {
      tenantDomain = arg.slice('--tenant-domain='.length).trim() || tenantDomain;
    } else if (arg === '--failfast') {
      failfast = true;
    }
  }

  return { env, mode, scope, apiUrl, tenantSlug, tenantDomain, failfast };
}

function resolveReleaseCommand(env, mode, scope) {
  const isWidget = mode === 'widget';
  const isLocal = scope === 'local' || scope === 'quick';

  if (env === 'staging') {
    if (isWidget && isLocal) {
      return 'npm run qa:release:staging:widget:quick';
    }
    if (isWidget) {
      return 'npm run qa:release:staging:widget';
    }
    if (isLocal) {
      return 'npm run qa:staging:gate:strict:quick';
    }
    return 'npm run qa:release:staging';
  }

  if (env === 'prod' || env === 'production') {
    if (isWidget && scope === 'dry') {
      return 'npm run qa:release:prod:widget:dry';
    }
    if (isWidget) {
      return 'npm run qa:release:prod:widget';
    }
    return 'npm run qa:release:prod';
  }

  return '';
}

function printResult(status, message) {
  const icon = status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : '❌';
  console.log(`${icon} ${message}`);
}

async function checkApiHealth(apiUrl) {
  try {
    const healthUrl = new URL('/health', apiUrl).toString();
    const response = await fetch(healthUrl);
    if (!response.ok) {
      return { ok: false, message: `API no saludable en ${healthUrl} (status ${response.status}).` };
    }
    return { ok: true, message: `API reachable: ${healthUrl}` };
  } catch {
    return { ok: false, message: `No se pudo alcanzar API en ${apiUrl}.` };
  }
}

async function checkTenantWidgetConfig(apiUrl, options) {
  const tenantRef = (options.tenantDomain || options.tenantSlug || '').trim();
  if (!tenantRef) {
    return {
      level: 'warn',
      message: 'Sin --tenant-slug/--tenant-domain: se omite validación de widgetEnabled/customDomain por tenant.'
    };
  }

  try {
    const profileUrl = new URL(`/public/${tenantRef}`, apiUrl).toString();
    const response = await fetch(profileUrl);
    if (!response.ok) {
      return {
        level: 'error',
        message: `No se pudo consultar perfil público (${profileUrl}) status=${response.status}.`
      };
    }

    const profile = await response.json();
    const widgetEnabled = Boolean(profile?.widgetEnabled);
    const customDomain = typeof profile?.customDomain === 'string' ? profile.customDomain.trim() : '';

    if (!widgetEnabled) {
      return {
        level: 'error',
        message: `Tenant ${tenantRef} tiene widgetEnabled=false.`
      };
    }

    if (!customDomain) {
      return {
        level: 'error',
        message: `Tenant ${tenantRef} no tiene customDomain configurado.`
      };
    }

    return {
      level: 'ok',
      message: `Tenant ${tenantRef} OK (widgetEnabled=true, customDomain=${customDomain}).`
    };
  } catch {
    return {
      level: 'error',
      message: `Fallo al validar tenant ${tenantRef} contra API pública.`
    };
  }
}

async function checkTenantWidgetEndpoints(apiUrl, options) {
  const tenantRef = (options.tenantDomain || options.tenantSlug || '').trim();
  if (!tenantRef) {
    return {
      level: 'warn',
      message: 'Sin --tenant-slug/--tenant-domain: se omite validación de widget-config/widget.js por tenant.'
    };
  }

  try {
    const widgetConfigUrl = new URL(`/public/${tenantRef}/widget-config`, apiUrl).toString();
    const widgetConfigResponse = await fetch(widgetConfigUrl);
    if (!widgetConfigResponse.ok) {
      return {
        level: 'error',
        message: `widget-config no disponible (${widgetConfigUrl}) status=${widgetConfigResponse.status}.`
      };
    }

    const widgetConfig = await widgetConfigResponse.json();
    const bookingUrl = typeof widgetConfig?.bookingUrl === 'string' ? widgetConfig.bookingUrl.trim() : '';
    if (!bookingUrl) {
      return {
        level: 'error',
        message: `widget-config para ${tenantRef} no trae bookingUrl válido.`
      };
    }

    const widgetScriptUrl = new URL(`/public/${tenantRef}/widget.js`, apiUrl).toString();
    const widgetScriptResponse = await fetch(widgetScriptUrl);
    if (!widgetScriptResponse.ok) {
      return {
        level: 'error',
        message: `widget.js no disponible (${widgetScriptUrl}) status=${widgetScriptResponse.status}.`
      };
    }

    const widgetScript = await widgetScriptResponse.text();
    if (!widgetScript.includes('data-apoint-book') && !widgetScript.includes('window.open')) {
      return {
        level: 'error',
        message: `widget.js para ${tenantRef} no contiene lógica esperada de apertura.`
      };
    }

    return {
      level: 'ok',
      message: `Endpoints widget OK para ${tenantRef} (widget-config + widget.js).`
    };
  } catch {
    return {
      level: 'error',
      message: `Fallo al validar endpoints widget para tenant ${tenantRef}.`
    };
  }
}

function checkDockerCompose() {
  const probe = spawnSync('docker', ['compose', 'version'], {
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  if (probe.status !== 0) {
    return { ok: false, message: 'Docker Compose no disponible o Docker Desktop apagado.' };
  }

  const running = spawnSync('docker', ['compose', 'ps', '--services', '--filter', 'status=running'], {
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  if (running.status !== 0) {
    return { ok: false, message: 'No se pudo consultar estado de servicios Docker Compose.' };
  }

  const services = String(running.stdout ?? '')
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const required = ['postgres', 'redis'];
  const missing = required.filter((item) => !services.includes(item));

  if (missing.length > 0) {
    return {
      ok: false,
      message: `Faltan servicios Docker corriendo: ${missing.join(', ')}.`
    };
  }

  return { ok: true, message: `Docker services activos: ${required.join(', ')}.` };
}

function checkEnvFiles(env) {
  const root = process.cwd();
  const base = path.join(root, '.env');
  const target = env === 'prod' || env === 'production' ? '.env.prod' : '.env.staging';
  const targetPath = path.join(root, target);

  const issues = [];

  if (!fs.existsSync(base)) {
    issues.push({ level: 'warn', message: 'No existe .env en raíz.' });
  } else {
    issues.push({ level: 'ok', message: '.env encontrado.' });
  }

  if (!fs.existsSync(targetPath)) {
    issues.push({ level: 'warn', message: `No existe ${target} en raíz.` });
  } else {
    issues.push({ level: 'ok', message: `${target} encontrado.` });
  }

  return issues;
}

async function run() {
  const options = parseArgs();
  const releaseCommand = resolveReleaseCommand(options.env, options.mode, options.scope);

  console.log('QA Release Doctor');
  console.log(`Escenario: env=${options.env} mode=${options.mode} scope=${options.scope} failfast=${options.failfast ? 'on' : 'off'}`);
  console.log('');

  let errorCount = 0;

  function registerResult(level, message) {
    if (level === 'ok') {
      printResult('ok', message);
      return;
    }
    if (level === 'warn') {
      printResult('warn', message);
      return;
    }

    printResult('error', message);
    errorCount += 1;
    if (options.failfast) {
      console.log('');
      console.log('Doctor terminó en failfast por error bloqueante.');
      process.exit(1);
    }
  }

  const nodeMajor = Number(process.versions.node.split('.')[0] ?? '0');
  if (nodeMajor >= 20) {
    registerResult('ok', `Node.js ${process.versions.node} compatible.`);
  } else {
    registerResult('error', `Node.js ${process.versions.node} no compatible (requiere >=20).`);
  }

  for (const item of checkEnvFiles(options.env)) {
    registerResult(item.level, item.message);
  }

  const localLike = options.scope === 'local' || options.scope === 'quick';
  if (localLike) {
    const docker = checkDockerCompose();
    if (docker.ok) {
      registerResult('ok', docker.message);
    } else {
      registerResult('error', docker.message);
    }

    const api = await checkApiHealth(options.apiUrl);
    if (api.ok) {
      registerResult('ok', api.message);
    } else {
      registerResult('error', api.message);
    }
  }

  if (options.mode === 'widget') {
    const tenantCheck = await checkTenantWidgetConfig(options.apiUrl, options);
    registerResult(tenantCheck.level, tenantCheck.message);

    const tenantEndpoints = await checkTenantWidgetEndpoints(options.apiUrl, options);
    registerResult(tenantEndpoints.level, tenantEndpoints.message);
  }

  if (!releaseCommand) {
    registerResult('error', 'No se pudo resolver comando recomendado para el escenario dado.');
  } else {
    registerResult('ok', `Comando recomendado: ${releaseCommand}`);
  }

  console.log('');
  if (errorCount > 0) {
    console.log(`Doctor finalizó con ${errorCount} error(es).`);
    process.exit(1);
    return;
  }

  console.log('Doctor finalizó sin errores bloqueantes.');
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Doctor falló: ${message}`);
  process.exit(1);
});
