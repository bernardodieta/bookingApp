const fs = require('node:fs');
const path = require('node:path');

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
