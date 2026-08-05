import { Badge } from '@/components/ui/badge';
import { PATIENT_STATUS_LABELS, type PatientStatus } from '@/lib/types';

const STATUS_VARIANT: Record<PatientStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  PAUSED: 'outline',
  DISCHARGED: 'secondary',
  ARCHIVED: 'destructive',
};

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PATIENT_STATUS_LABELS[status]}</Badge>;
}
