import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Apoint App',
  description: 'SaaS de gestión de citas'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
