import type { Metadata, Viewport } from 'next';
import { Assistant, IBM_Plex_Mono, Rubik } from 'next/font/google';
import './globals.css';

const rubik = Rubik({
  subsets: ['latin', 'hebrew'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rubik',
  display: 'swap',
});

const assistant = Assistant({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '600'],
  variable: '--font-assistant',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'לילה לבן · Channel Intelligence',
  description: 'לוח בקרה אנליטי לערוץ היוטיוב לילה לבן',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${assistant.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-canvas text-fg antialiased">{children}</body>
    </html>
  );
}
