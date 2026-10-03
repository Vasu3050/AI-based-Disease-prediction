import { Alert } from '../ui/Alert';

const DEFAULT_TEXT =
  'This is an educational decision-support prototype — not a medical diagnosis and not medical advice. ' +
  'Model outputs are probabilistic estimates that can be wrong. Do not start, stop, or change any medication ' +
  'based on these results. Always confirm findings with a qualified healthcare professional. Emergency symptoms ' +
  'require immediate medical attention regardless of any result shown here.';

export function DisclaimerBanner({ text }: { text?: string }) {
  return (
    <Alert kind="medical" title="Important: not a diagnosis">
      <p>{text ?? DEFAULT_TEXT}</p>
    </Alert>
  );
}
