/**
 * Extrae un mensaje legible del cuerpo de error de la API (formato NestJS:
 * `{ message: string | string[], error, statusCode }`). Si no es JSON, devuelve
 * el texto tal cual.
 */
export function apiErrorMessage(text: string, status?: number): string {
  try {
    const json = JSON.parse(text) as { message?: unknown };
    if (Array.isArray(json.message)) {
      return json.message.join('. ');
    }
    if (typeof json.message === 'string' && json.message) {
      return json.message;
    }
  } catch {
    // no es JSON
  }
  return text || (status ? `Error ${status}` : 'Ocurrió un error inesperado.');
}
