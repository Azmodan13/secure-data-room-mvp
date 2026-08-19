import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';
import { AppProviders } from '@/components/app-providers';

export const metadata: Metadata = {
  title: 'Secure Data Room',
  description: 'Securely organize and share due diligence documents.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full flex-col antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
