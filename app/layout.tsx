import type { Metadata } from 'next';
import SiteFooter from './components/SiteFooter';
import './styles/globals.css';

export const metadata: Metadata = {
  title: 'Gototrip',
  description:
    'Gototrip vous aide à planifier votre voyage : destinations, activités, restaurants, hébergements, transport et planning jour par jour.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}