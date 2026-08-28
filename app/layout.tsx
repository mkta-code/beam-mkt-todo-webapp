import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Beam MKT To do Webapp',
  description: 'Personal marketing task dashboard connected to Beam MKT Google Sheet.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
