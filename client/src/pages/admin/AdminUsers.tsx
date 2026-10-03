import { Search, ShieldCheck, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { usePageTitle } from '../../lib/usePageTitle';
import { useAuth } from '../../context/AuthContext';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  reportCount: number;
}

export function AdminUsers() {
  usePageTitle('Admin · Users');
  const toast = useToast();
  const { user: me } = useAuth();

  const [data, setData] = useState<{ users: AdminUser[]; total: number; page: number; pages: number } | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const load = useCallback(async (targetPage: number, query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: '15' });
      if (query.trim()) params.set('q', query.trim());
      const res = await api.get<{ users: AdminUser[]; total: number; page: number; pages: number }>(
        `/admin/users?${params.toString()}`
      );
      setData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users.');
      setData({ users: [], total: 0, page: 1, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchUser = async (u: AdminUser, patch: { role?: 'user' | 'admin'; disabled?: boolean }) => {
    setBusyId(u.id);
    try {
      await api.patch(`/admin/users/${u.id}`, patch);
      toast.success(`Updated ${u.email}.`);
      await load(page, q);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await api.del(`/admin/users/${deleteTarget.id}`);
      toast.success(`Deleted ${deleteTarget.email} and all their data.`);
      setDeleteTarget(null);
      await load(page, q);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="User management"
        description="Roles, disabling, and full data deletion. Actions are audit-logged."
      />

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              label="Search users"
              placeholder="Email or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  void load(1, q);
                }
              }}
            />
          </div>
          <Button
            icon={<Search className="h-4 w-4" />}
            onClick={() => {
              setPage(1);
              void load(1, q);
            }}
          >
            Search
          </Button>
        </CardBody>
      </Card>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : !data || data.users.length === 0 ? (
        <EmptyState title="No users found" description="Try a different search term." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Reports</th>
                  <th className="px-3 py-3 font-medium">Last login</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.users.map((u) => {
                  const isSelf = u.id === me?.id;
                  return (
                    <tr key={u.id} className={u.disabled ? 'opacity-60' : ''}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {u.name} {isSelf ? <span className="text-xs text-brand-600">(you)</span> : null}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                        <p className="text-[11px] text-gray-400">joined {formatDate(u.createdAt)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          aria-label={`Role for ${u.email}`}
                          className="h-8 w-28 text-xs"
                          value={u.role}
                          disabled={isSelf || busyId === u.id}
                          onChange={(e) => void patchUser(u, { role: e.target.value as 'user' | 'admin' })}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </Select>
                      </td>
                      <td className="px-3 py-3">
                        {u.disabled ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            disabled
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            active
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">{u.reportCount}</td>
                      <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'never'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isSelf || busyId === u.id}
                            onClick={() => void patchUser(u, { disabled: !u.disabled })}
                          >
                            {u.disabled ? 'Enable' : 'Disable'}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={isSelf || busyId === u.id}
                            icon={<UserX className="h-3.5 w-3.5" />}
                            onClick={() => setDeleteTarget(u)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.pages > 1 ? (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); void load(page - 1, q); }}>
                Previous
              </Button>
              <span className="text-xs text-gray-500">
                Page {data.page} of {data.pages} · {data.total} users
              </span>
              <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => { setPage(page + 1); void load(page + 1, q); }}>
                Next
              </Button>
            </div>
          ) : null}
        </Card>
      )}

      <div className="mt-4">
        <Alert kind="info" title="Data deletion is complete">
          Deleting a user removes their reports, predictions, patient profiles and audit trail —{' '}
          <ShieldCheck className="inline h-3.5 w-3.5" /> privacy by design.
        </Alert>
      </div>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.email}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busyId === deleteTarget?.id} onClick={doDelete}>
              Delete user + data
            </Button>
          </>
        }
      >
        <Alert kind="warning" title="This cannot be undone">
          All of this user&apos;s health data will be permanently removed.
        </Alert>
      </Modal>
    </div>
  );
}
