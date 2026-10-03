import { Filter, GitCompareArrows, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ValueStatusPill } from '../../components/domain/ValueStatusPill';
import { RiskBadge } from '../../components/domain/RiskBadge';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Paginated, Patient, ReportWithPrediction } from '../../lib/types';
import { usePageTitle } from '../../lib/usePageTitle';

export function HistoryPage() {
  usePageTitle('History');
  const navigate = useNavigate();

  const [data, setData] = useState<Paginated<ReportWithPrediction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [patientId, setPatientId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(targetPage), limit: '15' });
        if (q.trim()) params.set('q', q.trim());
        if (patientId) params.set('patientId', patientId);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const res = await api.get<Paginated<ReportWithPrediction>>(`/reports?${params.toString()}`);
        setData(res);
      } catch {
        setData({ items: [], total: 0, page: 1, limit: 15, pages: 1 });
      } finally {
        setLoading(false);
      }
    },
    [q, patientId, from, to]
  );

  useEffect(() => {
    void load(1);
    setPage(1);
    setSelected([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, patientId, from, to]);

  useEffect(() => {
    api
      .get<{ patients: Patient[] }>('/patients')
      .then((r) => setPatients(r.patients))
      .catch(() => setPatients([]));
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1]!, id];
      return [...prev, id];
    });
  };

  const compareHref =
    selected.length === 2 ? `/app/compare?left=${selected[0]}&right=${selected[1]}` : null;

  return (
    <div>
      <PageHeader
        title="Report history"
        description="All stored reports. Select exactly two to compare, or open one for details."
        actions={
          compareHref ? (
            <Button icon={<GitCompareArrows className="h-4 w-4" />} onClick={() => navigate(compareHref)}>
              Compare selected
            </Button>
          ) : (
            <Link to="/app/reports/new">
              <Button>New report</Button>
            </Link>
          )
        }
      />

      <Card className="mb-6">
        <CardBody className="grid gap-4 md:grid-cols-4">
          <Input
            label="Search"
            placeholder="Patient name or lab…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="md:col-span-1"
          />
          <Select label="Patient" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">All patients</option>
            {patients.map((p) => (
              <option key={p._id ?? p.id} value={p._id ?? p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </CardBody>
      </Card>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="No reports found"
          description={
            q || patientId || from || to
              ? 'Try adjusting the filters.'
              : 'Submit your first blood report to start building history.'
          }
          action={
            <Link to="/app/reports/new">
              <Button>New report</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => {
            const tests = Object.values(r.tests);
            const abnormal = tests.filter((t) => t.status && t.status !== 'normal');
            const isSelected = selected.includes(r.id);
            return (
              <Card key={r.id} className={isSelected ? 'ring-2 ring-brand-500' : ''}>
                <CardBody className="flex flex-wrap items-center gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(r.id)}
                    aria-label={`Select report from ${formatDate(r.reportDate)} for comparison`}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(r.reportDate)}
                      {r.patient?.name ? <span className="text-gray-500">· {r.patient.name}</span> : null}
                      {r.demoLabel ? (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          DEMO
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {tests.length} tests · {abnormal.length} outside ranges
                      {r.labName ? ` · ${r.labName}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.latestPrediction?.bands
                      .filter((b) => b.band)
                      .slice(0, 3)
                      .map((b) => <RiskBadge key={b.targetId} band={b.band!} small />)}
                    {abnormal.length > 0
                      ? abnormal
                          .slice(0, 2)
                          .map((t, i) => <ValueStatusPill key={i} status={t.status} />)
                      : null}
                  </div>
                  <Link to={`/app/reports/${r.id}`}>
                    <Button variant="secondary" size="sm">
                      Open
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            );
          })}

          {data.pages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                icon={<Filter className="h-3.5 w-3.5 rotate-90" />}
                onClick={() => {
                  const p = Math.max(1, page - 1);
                  setPage(p);
                  void load(p);
                }}
              >
                Previous
              </Button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Page {data.page} of {data.pages} · {data.total} reports
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => {
                  const p = Math.min(data.pages, page + 1);
                  setPage(p);
                  void load(p);
                }}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
