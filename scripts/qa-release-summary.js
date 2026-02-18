function parseArgs() {
  const args = process.argv.slice(2);
  let env = (process.env.npm_config_env ?? '').trim().toLowerCase();
  let mode = (process.env.npm_config_mode ?? '').trim().toLowerCase();
  let scope = (process.env.npm_config_scope ?? '').trim().toLowerCase();

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      env = arg.slice('--env='.length).trim().toLowerCase();
    } else if (arg.startsWith('--mode=')) {
      mode = arg.slice('--mode='.length).trim().toLowerCase();
    } else if (arg.startsWith('--scope=')) {
      scope = arg.slice('--scope='.length).trim().toLowerCase();
    }
  }

  return { env, mode, scope };
}

function resolveCommand(env, mode, scope) {
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

function printHeader() {
  console.log('QA Release Command Helper');
  console.log('');
  console.log('Escenarios disponibles:');
  console.log('  staging/full/remote  -> npm run qa:release:staging');
  console.log('  staging/widget/remote -> npm run qa:release:staging:widget');
  console.log('  staging/widget/local  -> npm run qa:release:staging:widget:quick');
  console.log('  prod/full/remote      -> npm run qa:release:prod');
  console.log('  prod/widget/remote    -> npm run qa:release:prod:widget');
  console.log('  prod/widget/dry       -> npm run qa:release:prod:widget:dry');
  console.log('');
}

function run() {
  const options = parseArgs();
  const command = resolveCommand(options.env, options.mode, options.scope);

  printHeader();

  if (!options.env && !options.mode && !options.scope) {
    console.log('Uso rápido:');
    console.log('  npm run qa:release:help -- --env=staging --mode=widget --scope=local');
    return;
  }

  if (!command) {
    console.log('No hay combinación soportada para esos parámetros.');
    console.log('Valores esperados:');
    console.log('  --env=staging|prod');
    console.log('  --mode=full|widget');
    console.log('  --scope=remote|local|quick|dry');
    process.exitCode = 1;
    return;
  }

  console.log(`Recomendado: ${command}`);
}

run();
