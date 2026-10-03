import { usePageTitle } from '../../lib/usePageTitle';
import { Card } from '../../components/ui/Card';

const STACK = [
  ['Frontend', 'React · Vite · TypeScript · Tailwind CSS · Recharts · React Router'],
  ['Backend', 'Node.js · Express · TypeScript · Zod · Helmet · rate limiting · JWT (HTTP-only cookie)'],
  ['Database', 'MongoDB · Mongoose · schema validation · indexes · audit logs'],
  ['ML', 'In-repo training pipeline (Node.js) · logistic regression · documented datasets · honest metrics'],
  ['AI explanation', 'Provider-agnostic LLM abstraction (OpenAI-compatible / xAI / none) — server-side only'],
  ['Quality', 'Vitest · Supertest · React Testing Library · ESLint · strict TypeScript · API smoke test'],
];

export function About() {
  usePageTitle('About');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">About MediPredict AI</h1>
      <p className="mt-4 leading-relaxed text-gray-600 dark:text-gray-300">
        MediPredict AI is a college major-project-grade web application exploring how an AI-assisted blood-test
        analysis pipeline can be built <em>honestly</em>: strict structured input, deterministic analysis, real
        (if limited) machine-learning models trained on documented public datasets, clear separation between ML
        prediction and LLM explanation, and no fabricated claims of clinical accuracy.
      </p>

      <h2 className="mt-10 text-xl font-semibold">What this project demonstrates</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        <li>Full-stack engineering: typed REST API, authentication, role-based access, admin tooling.</li>
        <li>Database engineering: schema design, indexes, audit logging, data deletion guarantees.</li>
        <li>Applied ML: dataset ingestion, preprocessing, training, evaluation, versioned model artifacts.</li>
        <li>Responsible AI: transparent pipeline, explainability, uncertainty communication, safety constraints.</li>
        <li>Security & privacy: password hashing, JWT cookies, input sanitization, rate limiting, minimal data.</li>
        <li>Quality engineering: automated tests, linting, strict types, smoke tests, production builds.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">Technology stack</h2>
      <div className="mt-4 space-y-3">
        {STACK.map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{k}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{v}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Honesty commitments</h2>
      <div className="mt-4 space-y-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        <p>
          The project explicitly refuses to fabricate medical accuracy. No &quot;99% accurate&quot; badges, no
          &quot;doctor-level&quot; claims, no pretending that demo data is clinical data. Where data or validation
          is insufficient, the software says so out loud — and so does the documentation (see{' '}
          <code className="rounded bg-black/5 px-1 dark:bg-white/10">docs/LIMITATIONS.md</code>).
        </p>
      </div>

      <h2 className="mt-10 text-xl font-semibold">How to explore it</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        <li>Run the stack locally (see README) and create an account.</li>
        <li>
          Run <code className="rounded bg-black/5 px-1 dark:bg-white/10">npm run demo:seed</code> to load labeled
          synthetic demo scenarios, or enter a structured report yourself.
        </li>
        <li>Open a prediction to see reference-range analysis, guideline panels, model cards and explanations.</li>
        <li>Compare reports and explore trends to see longitudinal behavior.</li>
        <li>Sign in as the admin demo account to explore user management, model monitoring and audit logs.</li>
      </ol>
    </div>
  );
}
