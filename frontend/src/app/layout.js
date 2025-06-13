import './globals.css';
import ThemeSwitcher from '@/components/ThemeSwitcher';

export const metadata = {
  title: 'Neutrinos Config Dashboard',
  description: 'Smart cache invalidation for JSON tree configs',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 antialiased">
        <header className="bg-blue-600 dark:bg-blue-800 text-white p-4 flex justify-between items-center shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight">Neutrinos Config Dashboard</h1>
          <ThemeSwitcher />
        </header>
        <main className="container mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}