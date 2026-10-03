import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../lib/usePageTitle';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

export function Register() {
  usePageTitle('Create account');
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const validate = (): string | null => {
    if (name.trim().length < 2) return 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
    if (password.length < 10) return 'Password must be at least 10 characters.';
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
      return 'Password must contain at least one letter and one number.';
    if (password !== confirm) return 'Passwords do not match.';
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const localError = validate();
    if (localError) {
      setError(localError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 md:py-20">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Free, private and only for education — you can delete everything anytime.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          {error ? <Alert kind="error">{error}</Alert> : null}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Input
              id="name"
              label="Name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
              autoComplete="new-password"
              required
              hint="At least 10 characters, including a letter and a number."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              id="confirm"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button type="submit" className="w-full" loading={loading} icon={<UserPlus className="h-4 w-4" />}>
              Create account
            </Button>
          </form>

          <p className="text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Blood-test data you enter is health-related information. By creating an account you acknowledge this is
            an educational prototype and not a medical service.
          </p>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
