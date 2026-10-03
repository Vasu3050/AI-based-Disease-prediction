import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { usePageTitle } from '../../lib/usePageTitle';

export function NotFound() {
  usePageTitle('Page not found');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <SearchX className="h-10 w-10 text-gray-400" />
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        The page you are looking for does not exist or may have moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/">
          <Button variant="secondary">Back to home</Button>
        </Link>
        <Link to="/app">
          <Button>Open dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
