import { ServerCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { api } from '../../lib/api';
import { usePageTitle } from '../../lib/usePageTitle';

interface SystemInfo {
  nodeEnv: string;
  port: number;
  engineVersion: string;
  database: string;
  llm: { enabled: boolean; provider: string; model: string | null; disabledReason: string | null };
  modelsDir: string;
  node: string;
  counts: { users: number; reports: number; predictions: number; patients: number };
}

export function AdminSystem() {
  usePageTitle('Admin · System');
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SystemInfo>('/admin/system')
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load system info.'));
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!info) return <SkeletonRows rows={4} />;

  const rows: [string, string][] = [
    ['Environment', info.nodeEnv],
    ['API port', String(info.port)],
    ['Engine version', info.engineVersion],
    ['Node.js', info.node],
    ['Database', info.database],
    ['Models directory', info.modelsDir],
    ['LLM provider', info.llm.provider === 'none' ? 'disabled' : info.llm.provider],
    ['LLM model', info.llm.model ?? '—'],
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="System configuration"
        description="Read-only snapshot. Configuration changes are made in .env (no code changes) followed by a server restart."
      />

      <Card>
        <CardHeader title="Runtime overview" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="w-48 px-5 py-3 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{k}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-800 dark:text-gray-200">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="Stored records" />
          <CardBody className="grid grid-cols-2 gap-3 text-sm">
            <p>Users: <strong>{info.counts.users}</strong></p>
            <p>Patients: <strong>{info.counts.patients}</strong></p>
            <p>Reports: <strong>{info.counts.reports}</strong></p>
            <p>Predictions: <strong>{info.counts.predictions}</strong></p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Switching models (no code changes)" />
          <CardBody className="space-y-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            <p className="flex items-start gap-2">
              <ServerCog className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
              Edit <code className="rounded bg-black/5 px-1 dark:bg-white/10">.env</code> (repo root or server/) and
              restart the API:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Local Ollama: LLM_PROVIDER=ollama, LLM_BASE_URL=http://127.0.0.1:11434/v1</li>
              <li>Grok: LLM_PROVIDER=xai, LLM_API_KEY=…, LLM_MODEL=grok-2-latest</li>
              <li>Any OpenAI-compatible: LLM_PROVIDER=openai-compatible + LLM_BASE_URL + LLM_MODEL + key</li>
            </ul>
            <p>
              {info.llm.enabled
                ? `Currently active: ${info.llm.provider} · ${info.llm.model}`
                : `LLM layer currently disabled${info.llm.disabledReason ? ` (${info.llm.disabledReason})` : ''}.`}
            </p>
          </CardBody>
        </Card>
      </div>

      {!info.llm.enabled ? (
        <div className="mt-4">
          <Alert kind="info" title="The app works without an LLM">
            All analysis, ML predictions and deterministic summaries are fully functional with the LLM layer disabled.
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
