import {
  Activity,
  Brain,
  FilePlus2,
  GitCompare,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Server,
  Settings,
  TrendingUp,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { ThemeToggle } from './ThemeToggle';

const USER_NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/reports/new', label: 'New report', icon: FilePlus2 },
  { to: '/app/patients', label: 'Patients', icon: Users },
  { to: '/app/history', label: 'History', icon: History },
  { to: '/app/trends', label: 'Trends', icon: TrendingUp },
  { to: '/app/compare', label: 'Compare', icon: GitCompare },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const ADMIN_NAV = [
  { to: '/app/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/app/admin/users', label: 'Users', icon: UserCog },
  { to: '/app/admin/models', label: 'Models', icon: Brain },
  { to: '/app/admin/audit', label: 'Audit logs', icon: ScrollText },
  { to: '/app/admin/system', label: 'System', icon: Server },
];

function SidebarLink({
  item,
  onClick,
}: {
  item: { to: string; label: string; icon: typeof Gauge; end?: boolean };
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" />
      {item.label}
    </NavLink>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <Link to="/app" onClick={onNavigate} className="focus-ring flex items-center gap-2 rounded-lg px-3 py-4">
        <span className="rounded-lg bg-brand-600 p-1.5 text-white">
          <Activity className="h-5 w-5" />
        </span>
        <span className="text-base font-semibold tracking-tight">
          MediPredict <span className="text-brand-600 dark:text-brand-400">AI</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {USER_NAV.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={onNavigate} />
        ))}
        {user?.role === 'admin' ? (
          <>
            <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Administration
            </p>
            {ADMIN_NAV.map((item) => (
              <SidebarLink key={item.to} item={item} onClick={onNavigate} />
            ))}
          </>
        ) : null}
      </nav>
      <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-800">
        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{user?.name}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:block">
        {sidebar()}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-gray-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="focus-ring absolute right-3 top-4 rounded-md p-1 text-gray-400"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar(() => setMobileOpen(false))}
          </aside>
        </div>
      ) : null}

      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90 md:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="focus-ring rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden text-sm text-gray-500 dark:text-gray-400 md:inline">
              Educational decision-support prototype — not a medical device
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          <Outlet />
        </main>

        <footer className="px-4 pb-8 md:px-8">
          <p className="mx-auto max-w-6xl text-xs text-gray-400 dark:text-gray-500">
            Model outputs are probabilistic estimates and not a diagnosis. Always confirm with a qualified
            healthcare professional. Emergency symptoms require immediate care regardless of any result shown here.
          </p>
        </footer>
      </div>
    </div>
  );
}
