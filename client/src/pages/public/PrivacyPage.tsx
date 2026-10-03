import { usePageTitle } from '../../lib/usePageTitle';

export function PrivacyPage() {
  usePageTitle('Privacy');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-3 text-gray-600 dark:text-gray-300">
        Blood-test values are sensitive health-related data. This prototype was designed to collect the minimum
        necessary and to make deletion easy.
      </p>

      <div className="mt-8 space-y-4">
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">What we store</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
            <li>Account: name, email, securely hashed password (bcrypt).</li>
            <li>
              Reports: the laboratory values you enter, your patient profile basics (name/age/sex), and an optional
              notes field.
            </li>
            <li>Predictions: the computed analysis results.</li>
            <li>
              Audit logs: security-relevant events (login, report created, etc.). Audit logs deliberately contain{' '}
              <strong>no laboratory values</strong>.
            </li>
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">What we do NOT do</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
            <li>No selling or sharing of data with third parties.</li>
            <li>No advertising trackers.</li>
            <li>No unnecessary logging of patient information.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">AI explanation layer (optional)</h2>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            When an LLM provider is configured, generating an explanation sends a{' '}
            <strong>minimal structured summary</strong> of already-computed results to that provider: age, sex,
            abnormal values flagged by the local analysis, guideline labels and model bands. Names, emails,
            account identifiers and your notes are <strong>never</strong> sent. If no provider is configured, a
            deterministic offline summary is used instead, and nothing leaves your server.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">Your controls</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
            <li>Delete any report and its predictions at any time.</li>
            <li>
              Delete your entire account in Settings → &quot;Delete account&quot; — this removes your reports,
              predictions, patient profiles and audit trail for your account.
            </li>
            <li>Run everything locally: MongoDB, the API and the ML models are self-hosted in this project.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
