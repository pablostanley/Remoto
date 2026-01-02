import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Remoto - Terminal in your pocket',
  description: 'Control your terminal from your phone. Run commands, monitor output, and get notifications when tasks complete. No account required.',
  keywords: ['terminal', 'remote terminal', 'mobile terminal', 'ssh', 'command line', 'cli', 'phone terminal', 'remote access', 'developer tools'],
  authors: [{ name: 'Pablo Stanley', url: 'https://x.com/pablostanley' }],
  creator: 'Pablo Stanley',
  metadataBase: new URL('https://remoto.sh'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://remoto.sh',
    title: 'Remoto - Terminal in your pocket',
    description: 'Control your terminal from your phone. Run commands, monitor output, and get notifications when tasks complete.',
    siteName: 'Remoto',
    images: [
      {
        url: '/remoto-og.png',
        width: 1200,
        height: 630,
        alt: 'Remoto - Terminal in your pocket',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Remoto - Terminal in your pocket',
    description: 'Control your terminal from your phone. Run commands, monitor output, and get notifications when tasks complete.',
    images: ['/remoto-og.png'],
    creator: '@pablostanley',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Remoto',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
