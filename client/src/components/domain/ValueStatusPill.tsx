import { STATUS_META } from '../../lib/format';
import type { ValueStatus } from '../../lib/types';
import { Badge } from '../ui/Badge';

export function ValueStatusPill({ status }: { status?: ValueStatus }) {
  if (!status) return null;
  const meta = STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
