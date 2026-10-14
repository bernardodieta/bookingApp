/**
 * Fecha YYYY-MM-DD en la zona horaria del navegador.
 * No usar `toISOString().slice(0, 10)`: devuelve la fecha UTC, que en México
 * a partir de las 18:00 ya es el día siguiente.
 */
export function localDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
