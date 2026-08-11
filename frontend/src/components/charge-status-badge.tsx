import { Badge } from '@/components/ui/badge';
import { CHARGE_STATUS_LABELS, type ChargeStatus } from '@/lib/types';

const STATUS_VARIANT: Record<ChargeStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  PARTIALLY_PAID: 'secondary',
  PAID: 'default',
  CANCELLED: 'destructive',
};

/** "Vencido" nunca é um status gravado — é PENDING/PARTIALLY_PAID com vencimento no passado
 * (ver finance.service.ts), então sinalizado aqui como um estado visual à parte. */
export function ChargeStatusBadge({ status, isOverdue }: { status: ChargeStatus; isOverdue: boolean }) {
  if (isOverdue) {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-500">
        Vencido
      </Badge>
    );
  }
  return <Badge variant={STATUS_VARIANT[status]}>{CHARGE_STATUS_LABELS[status]}</Badge>;
}
