import { usePageTitle } from '../../lib/usePageTitle';
import { Alert } from '../../components/ui/Alert';

export function Safety() {
  usePageTitle('Safety & limitations');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Safety & limitations</h1>
      <p className="mt-3 text-gray-600 dark:text-gray-300">
        We take the risks of health software seriously. These are the hard rules this project was built around —
        they are enforced in the product itself, not just on this page.
      </p>

      <div className="mt-8 space-y-4">
        <Alert kind="medical" title="Not a diagnosis — ever">
          MediPredict AI is an educational decision-support prototype. Nothing it displays is a medical diagnosis
          or medical advice. Results must be interpreted by a qualified healthcare professional.
        </Alert>

        <section className="prose-sm space-y-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">What the system will never do</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
            <li>Claim a definitive diagnosis from laboratory values alone.</li>
            <li>Recommend starting, stopping, or changing any medication or treatment.</li>
            <li>Present model scores as calibrated clinical probabilities or &quot;chances of disease&quot;.</li>
            <li>Fabricate accuracy: we do not claim &quot;99% accurate&quot;, &quot;doctor-level&quot;, or
              &quot;clinically proven&quot; — because none of that has been demonstrated for this prototype.</li>
            <li>Replace professional medical evaluation or emergency care.</li>
          </ul>
        </section>

        <section className="prose-sm space-y-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">Known limitations of the models</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
            <li>
              ML models are trained on <strong>specific public research datasets</strong> (documented in
              docs/DATASETS.md). Those populations may differ substantially from you.
            </li>
            <li>
              Reported metrics (ROC-AUC, sensitivity, etc.) come from held-out splits of the same datasets — they
              are <strong>not</strong> evidence of real-world clinical performance and have not been externally
              validated.
            </li>
            <li>Models can produce false negatives (miss real problems) and false positives.</li>
            <li>
              Guideline indicators follow published thresholds (WHO, ADA, NCEP, KDIGO-style) but laboratory
              reference ranges vary between labs; a flag is not proof of disease.
            </li>
            <li>Missing values are never imputed silently — if inputs are missing, models are skipped and say so.</li>
          </ul>
        </section>

        <section className="prose-sm space-y-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">Emergency situations</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            If you have chest pain, difficulty breathing, severe bleeding, fainting, confusion, or any other urgent
            symptom, seek emergency medical care immediately — do not rely on this or any software first.
          </p>
        </section>

        <section className="prose-sm space-y-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">Demo data</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            The repository ships with synthetic demonstration reports labeled{' '}
            <strong>&quot;DEMO / SYNTHETIC DATA — NOT FOR CLINICAL USE&quot;</strong>. They exist purely to
            demonstrate the software in a college presentation and are not real patient data.
          </p>
        </section>
      </div>
    </div>
  );
}
