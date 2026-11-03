import './globals.css';

export const metadata = {
  title: 'slipshare • Direct Local File & Text Transfer',
  description: 'Instant local file, text and link sharing between mobile and laptop devices with zero cloud intermediaries.',
  icons: {
    icon: '/icons/ic_app_decorated.svg',
    apple: '/icons/ic_app_decorated_128.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        {/* Explicit viewport tag as fallback for older Next.js rendering */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#13B5EA" />
      </head>
      <body>{children}</body>
    </html>
  );
}
