import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Apoint — Gestiona tus citas de forma simple y profesional',
  description: 'Plataforma SaaS para agendar, confirmar y organizar citas de tu negocio. Planes desde gratis.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
