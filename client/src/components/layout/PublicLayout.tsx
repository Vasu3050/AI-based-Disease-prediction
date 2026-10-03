import { Activity } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/about', label: 'About' },
  { to: '/safety', label: 'Safety & limitations' },
  { to: '/privacy', label: 'Privacy' },
];

export function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Link to="/" className="focus-ring flex items-center gap-2 rounded-lg">
            <span className="rounded-lg bg-brand-600 p-1.5 text-white">
              <Activity className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              MediPredict <span className="text-brand-600 dark:text-brand-400">AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `focus-ring rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link to="/app">
                <Button size="sm">Open dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            <strong className="font-semibold">MediPredict AI is an educational prototype</strong> — not a medical
            device and not a diagnostic service. Predictions are probabilistic model outputs that can be wrong.
            Always consult a qualified healthcare professional; in an emergency, seek immediate medical attention.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            <Link className="hover:text-gray-800 dark:hover:text-gray-200" to="/how-it-works">
              How it works
            </Link>
            <Link className="hover:text-gray-800 dark:hover:text-gray-200" to="/safety">
              Safety & limitations
            </Link>
            <Link className="hover:text-gray-800 dark:hover:text-gray-200" to="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-gray-800 dark:hover:text-gray-200" to="/about">
              About
            </Link>
            <span className="ml-auto">© {new Date().getFullYear()} MediPredict AI (college project)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
