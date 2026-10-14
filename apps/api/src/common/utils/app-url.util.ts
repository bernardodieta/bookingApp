/**
 * URL pública del frontend, para links en correos y redirecciones.
 * Históricamente cada módulo leía una variable distinta; se aceptan todas,
 * con NEXT_PUBLIC_APP_URL como la principal.
 */
export function webAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.WEB_APP_URL ??
    process.env.APP_URL ??
    process.env.WEB_BASE_URL ??
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}
