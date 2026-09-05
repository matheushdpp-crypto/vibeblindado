import type { Metadata } from 'next';
import { Chakra_Petch, Archivo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const chakra = Chakra_Petch({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-chakra'
});
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-archivo'
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono'
});

export const metadata: Metadata = {
  title: 'BLINDADO | Auditoria de segurança para apps vibecodados',
  description:
    'Cole o link do seu repositório público do GitHub e receba em minutos uma auditoria de segurança por IA: dados sem isolamento, permissões furadas, IDOR, chaves expostas e XSS. Grátis.',
  keywords: [
    'segurança vibecode', 'auditoria segurança app', 'lovable segurança',
    'cursor segurança', 'supabase RLS', 'vazamento de dados app', 'bolt segurança'
  ],
  openGraph: {
    title: 'BLINDADO: seu app subiu em dias. Uma falha derruba em minutos.',
    description: 'Auditoria de segurança por IA para apps criados com Lovable, Cursor, Bolt e afins. Cole o repo, receba o relatório.',
    locale: 'pt_BR',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${chakra.variable} ${archivo.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
