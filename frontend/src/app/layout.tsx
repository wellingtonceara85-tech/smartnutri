import type { Metadata } from 'next';
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { AppQueryProvider } from '@/lib/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SmartNutri',
  description: 'Cadastro de pacientes, acompanhamento e evolução corporal para nutricionistas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-muted/30">
        <AppQueryProvider>
          <AuthProvider>
            <ThemeProvider>
              {children}
              <Toaster richColors position="top-right" />
            </ThemeProvider>
          </AuthProvider>
        </AppQueryProvider>
      </body>
    </html>
  );
}
