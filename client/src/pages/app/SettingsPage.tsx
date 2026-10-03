import { KeyRound, Monitor, Moon, Save, Sun, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { usePageTitle } from '../../lib/usePageTitle';

export function SettingsPage() {
  usePageTitle('Settings');
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const saveName = async () => {
    setSavingName(true);
    try {
      const data = await api.patch<{ user: typeof user }>('/users/me', { name: name.trim() });
      setUser(data.user);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    setPwError('');
    if (pw.next.length < 10 || !/[a-zA-Z]/.test(pw.next) || !/[0-9]/.test(pw.next)) {
      setPwError('New password must be at least 10 characters with a letter and a number.');
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError('Passwords do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await api.post('/users/me/password', {
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed.');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setSavingPw(false);
    }
  };

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    setTheme(t);
    api
      .patch('/users/me', { settings: { theme: t } })
      .then((data) => setUser((data as { user: typeof user }).user))
      .catch(() => undefined);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await api.del('/users/me', { password: deletePassword });
      await logout();
      toast.success('Your account and all health data were deleted.');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setDeleting(false);
    }
  };

  const THEMES = [
    { id: 'light' as const, label: 'Light', icon: Sun },
    { id: 'dark' as const, label: 'Dark', icon: Moon },
    { id: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Account, appearance and data controls." />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Profile" subtitle={user?.email} />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Email" value={user?.email ?? ''} disabled hint="Email changes are not supported in this prototype." />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Role: {user?.role} · member since {user?.createdAt ? formatDate(user.createdAt) : '—'}
              </p>
              <Button size="sm" loading={savingName} icon={<Save className="h-4 w-4" />} onClick={saveName} disabled={!name.trim() || name.trim() === user?.name}>
                Save profile
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Appearance" subtitle="Theme preference (also stored on your account)" />
          <CardBody>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTheme(t.id)}
                  className={`focus-ring flex flex-1 flex-col items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium transition-colors ${
                    theme === t.id
                      ? 'border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Change password" subtitle="You stay signed in on this device" />
          <CardBody className="space-y-4">
            {pwError ? <Alert kind="error">{pwError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Current password" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              <Input label="New password" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              <Input label="Confirm new" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" loading={savingPw} icon={<KeyRound className="h-4 w-4" />} onClick={savePassword} disabled={!pw.current || !pw.next || !pw.confirm}>
                Update password
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="border-red-200 dark:border-red-900/60">
          <CardHeader title="Danger zone" subtitle="Irreversible actions" />
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-4 w-4 text-red-500" />
              <p className="max-w-md text-sm text-gray-600 dark:text-gray-300">
                Delete your account and <strong>all related health data</strong>: patient profiles, reports,
                predictions and your audit trail. This cannot be undone.
              </p>
            </div>
            <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete account permanently?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} disabled={!deletePassword} onClick={deleteAccount}>
              Delete everything
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Alert kind="warning" title="This cannot be undone">
            All reports, analyses and patient profiles will be permanently removed from the database.
          </Alert>
          <Input
            label="Confirm with your password"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
