import './globals.css';
import Script from 'next/script';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6910725183348370"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      {children}
    </>
  );
}