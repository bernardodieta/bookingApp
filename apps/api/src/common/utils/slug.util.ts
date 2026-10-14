/**
 * Convierte un nombre en slug URL-safe conservando las letras acentuadas
 * ("Clínica Méndez" → "clinica-mendez" en lugar de "cl-nica-m-ndez").
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
