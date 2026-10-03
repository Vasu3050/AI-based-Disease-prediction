import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../lib/usePageTitle';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

export function Login() {
  usePageTitle('Sign in');
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from ?? '/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 md:py-20">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Sign in to submit reports and view your analysis history.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          {error ? <Alert kind="error">{error}</Alert> : null}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" className="w-full" loading={loading} icon={<LogIn className="h-4 w-4" />}>
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            No account?{' '}
            <Link to="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Create one
            </Link>
          </p>
        </CardBody>
      </Card>

      <div className="mt-4">
        <Alert kind="info" title="Demo account (local development)">
          After running <code className="rounded bg-black/5 px-1 dark:bg-white/10">npm run demo:seed</code>, you can
          sign in with <strong>demo@medipredict.local</strong> / <strong>DemoPass123!</strong>
        </Alert>
      </div>
    </div>
  );
}
