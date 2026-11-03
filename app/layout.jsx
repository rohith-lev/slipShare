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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>{children}</body>
    </html>
  );
}
