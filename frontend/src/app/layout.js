import './globals.css';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import Link from 'next/link';
import { PerformanceProvider } from '@/lib/PerformanceContext';
import { TenantConfigProvider } from '@/lib/TenantConfigContext';

export const metadata = {
  title: 'Neutrinos Config Dashboard',
  description: 'Smart cache invalidation for JSON tree configs',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 antialiased">
        <PerformanceProvider>
          <TenantConfigProvider>
            <header className="bg-blue-600 dark:bg-blue-800 text-white p-4 flex justify-between items-center shadow-lg">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold tracking-tight">Neutrinos Config Dashboard</h1>
                <nav className="flex space-x-4">
                  <Link
                    href="/"
                    className="text-white hover:text-blue-200 dark:hover:text-blue-300"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/performance"
                    className="text-white hover:text-blue-200 dark:hover:text-blue-300"
                  >
                    Performance
                  </Link>
                  <Link
                    href="/monitoring"
                    className="text-white hover:text-blue-200 dark:hover:text-blue-300"
                  >
                    Monitoring
                  </Link>
                </nav>
              </div>
              <ThemeSwitcher />
            </header>
            <main className="container mx-auto p-6">{children}</main>
          </TenantConfigProvider>
        </PerformanceProvider>
      </body>
    </html>
  );
}