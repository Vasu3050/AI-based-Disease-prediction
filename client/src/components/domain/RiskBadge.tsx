import { BAND_META } from '../../lib/format';
import type { RiskBand } from '../../lib/types';
import { Badge } from '../ui/Badge';

export function RiskBadge({ band, small = false }: { band: RiskBand; small?: boolean }) {
  const meta = BAND_META[band];
  return (
    <Badge className={meta.className} title={meta.description}>
      {small ? meta.label.split(' ')[0] : meta.label}
    </Badge>
  );
}
