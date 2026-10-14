import type { CapacitorConfig } from '@capacitor/cli';

/**
 * La app es un cascarón que abre la web desplegada: cada deploy de la web
 * actualiza la app sin pasar por las tiendas.
 *
 * APOINT_APP_URL se lee al hacer `cap sync`:
 *   - Pruebas en tu teléfono por Wi-Fi: http://<IP-de-tu-PC>:3006/login
 *   - Producción: https://<tu-dominio>/login
 * Sin la variable, la app muestra la página de www/ indicando que falta configurarla.
 */
const appUrl = process.env.APOINT_APP_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.bernardodieta.apoint',
  appName: 'Apoint',
  webDir: 'www',
  server: appUrl
    ? {
        url: appUrl,
        // Solo para pruebas en red local con http://; en producción la URL debe ser https
        cleartext: appUrl.startsWith('http://')
      }
    : undefined
};

export default config;
