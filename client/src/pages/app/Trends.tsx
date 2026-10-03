import { TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendChart } from '../../components/charts/TrendChart';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { api } from '../../lib/api';
import type { Patient, TestCatalogItem, TrendSeries } from '../../lib/types';
import { usePageTitle } from '../../lib/usePageTitle';

export function Trends() {
  usePageTitle('Trends');
  const [series, setSeries] = useState<TrendSeries[] | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [catalog, setCatalog] = useState<TestCatalogItem[]>([]);

  useEffect(() => {
    api
      .get<{ patients: Patient[] }>('/patients')
      .then((r) => setPatients(r.patients))
      .catch(() => setPatients([]));
    api
      .get<{ tests: TestCatalogItem[] }>('/meta/blood-tests')
      .then((r) => setCatalog(r.tests))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSeries(null);
    (async () => {
      try {
        const params = patientId ? `?patientId=${patientId}` : '';
        const res = await api.get<{ series: TrendSeries[] }>(`/reports/trends${params}`);
        if (!cancelled) setSeries(res.series);
      } catch {
        if (!cancelled) setSeries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const sex = useMemo(() => {
    const p = patients.find((x) => (x._id ?? x.id) === patientId);
    return p?.sex ?? 'default';
  }, [patients, patientId]);

  const catalogByKey = useMemo(() => new Map(catalog.map((c) => [c.key, c])), [catalog]);

  const multiPoint = series?.filter((s) => s.points.length >= 2) ?? [];
  const singlePoint = series?.filter((s) => s.points.length === 1) ?? [];

  return (
    <div>
      <PageHeader
        title="Trends"
        description="Longitudinal view of each marker across stored reports. Shaded bands show typical reference ranges."
        actions={
          <Select
            aria-label="Filter by patient"
            className="w-56"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">All patients</option>
            {patients.map((p) => (
              <option key={p._id ?? p.id} value={p._id ?? p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        }
      />

      {series === null ? (
        <SkeletonRows rows={4} />
      ) : series.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-8 w-8" />}
          title="Not enough data for trends"
          description="Submit at least one report — trends become more meaningful with two or more reports over time."
          action={
            <Link to="/app/reports/new">
              <Button>New report</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {multiPoint.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                With multiple points
              </h2>
              <div className="grid gap-5 lg:grid-cols-2">
                {multiPoint.map((s) => {
                  const def = catalogByKey.get(s.key);
                  const range = def?.ranges[sex as 'male' | 'female' | 'other'] ?? def?.ranges.default;
                  return (
                    <Card key={s.key}>
                      <CardBody>
                        <TrendChart series={s} range={range} />
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </section>
          ) : null}

          {singlePoint.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Single data point (more reports will unlock trends)
              </h2>
              <div className="grid gap-5 lg:grid-cols-2">
                {singlePoint.map((s) => {
                  const def = catalogByKey.get(s.key);
                  const range = def?.ranges[sex as 'male' | 'female' | 'other'] ?? def?.ranges.default;
                  return (
                    <Card key={s.key}>
                      <CardBody>
                        <TrendChart series={s} range={range} height={180} />
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </section>
          ) : null}

          <Card>
            <CardHeader
              title="About trend charts"
              subtitle="Rendered from your stored reports only — no interpolation, no invented points."
            />
            <CardBody className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Each report contributes one point per test on its report date. Ranges shown are typical adult
              references (lab-specific ranges are respected per report in the analysis itself).
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
