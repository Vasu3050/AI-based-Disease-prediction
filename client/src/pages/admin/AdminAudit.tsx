import { useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { usePageTitle } from '../../lib/usePageTitle';

interface AuditItem {
  id: string;
  action: string;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
}

const KNOWN_ACTIONS = [
  'USER_REGISTERED',
  'USER_LOGIN',
  'USER_LOGIN_FAILED',
  'USER_LOGOUT',
  'USER_UPDATED',
  'USER_DELETED',
  'PASSWORD_CHANGED',
  'PATIENT_CREATED',
  'PATIENT_UPDATED',
  'PATIENT_DELETED',
  'REPORT_CREATED',
  'REPORT_DELETED',
  'REPORT_COMPARED',
  'PREDICTION_CREATED',
  'EXPLANATION_GENERATED',
  'ADMIN_USER_UPDATED',
  'ADMIN_MODEL_REFRESHED',
];

export function AdminAudit() {
  usePageTitle('Admin · Audit logs');
  const toast = useToast();
  const [data, setData] = useState<{ logs: AuditItem[]; total: number; page: number; pages: number } | null>(null);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async (targetPage: number, actionFilter: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: '30' });
      if (actionFilter) params.set('action', actionFilter);
      const res = await api.get<{ logs: AuditItem[]; total: number; page: number; pages: number }>(
        `/admin/audit-logs?${params.toString()}`
      );
      setData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load audit logs.');
      setData({ logs: [], total: 0, page: 1, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description="Security-relevant events only. Audit entries deliberately contain no laboratory values or other health data."
      />

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-end gap-3">
          <Select
            label="Filter by action"
            className="w-72"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
              void load(1, e.target.value);
            }}
          >
            <option value="">All actions</option>
            {KNOWN_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : !data || data.logs.length === 0 ? (
        <EmptyState title="No audit events" description="Events appear here as users interact with the system." />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                    <th className="px-3 py-3 font-medium">Actor</th>
                    <th className="px-3 py-3 font-medium">Entity</th>
                    <th className="px-5 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.logs.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(l.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 font-mono text-[11px] ${
                            l.action.includes('FAILED') || l.action.includes('DELETED')
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {l.action}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">{l.actorEmail ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {l.entityType ? `${l.entityType}${l.entityId ? ` #${l.entityId.slice(-6)}` : ''}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">{l.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {data.pages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); void load(page - 1, action); }}>
                Previous
              </Button>
              <span className="text-xs text-gray-500">
                Page {data.page} of {data.pages} · {data.total} events
              </span>
              <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => { setPage(page + 1); void load(page + 1, action); }}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-5">
        <Alert kind="info" title="Privacy note">
          Login failures record the attempted email for security monitoring. Laboratory values are never written to
          audit logs.
        </Alert>
      </div>
    </div>
  );
}
