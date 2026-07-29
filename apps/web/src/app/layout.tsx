import type { Metadata } from 'next';
import localFont from 'next/font/local';

import './globals.css';

const outfit = localFont({
  variable: '--font-outfit',
  display: 'swap',
  src: [
    {
      path: '../../../../node_modules/@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf',
      weight: '400',
    },
    {
      path: '../../../../node_modules/@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf',
      weight: '600',
    },
    {
      path: '../../../../node_modules/@expo-google-fonts/outfit/800ExtraBold/Outfit_800ExtraBold.ttf',
      weight: '800',
    },
  ],
});

const gabarito = localFont({
  variable: '--font-gabarito',
  display: 'swap',
  src: '../../../../node_modules/@expo-google-fonts/gabarito/600SemiBold/Gabarito_600SemiBold.ttf',
  weight: '600',
});

export const metadata: Metadata = {
  title: 'Flare — Espacios para cualquier grupo',
  description: 'Mensajes, avisos, fotos y recordatorios para equipos, proyectos y comunidades.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${outfit.variable} ${gabarito.variable}`}>{children}</body>
    </html>
  );
}
