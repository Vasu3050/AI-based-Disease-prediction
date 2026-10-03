import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`focus-ring rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 ${className ?? ''}`}
    >
      {resolved === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
