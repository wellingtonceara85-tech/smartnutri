'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { listPaymentMethods } from '@/lib/api/payment-methods';
import { listPlans } from '@/lib/api/plans';
import { createTreatmentCycle } from '@/lib/api/treatment-cycles';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import { todayLocalDateKey } from '@/lib/appointment-datetime';

const cycleSchema = z.object({
  planId: z.string().min(1, 'Selecione um plano'),
  startDate: z.string().min(1, 'Informe a data de início'),
  discountType: z.enum(['FIXED', 'PERCENTAGE']),
  discountValue: z.coerce.number().min(0, 'Não pode ser negativo'),
  paymentMethodId: z.string().optional(),
  notes: z.string().optional().or(z.literal('')),
});

type CycleFormInput = z.input<typeof cycleSchema>;
type CycleFormOutput = z.output<typeof cycleSchema>;

interface TreatmentCycleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onCreated?: () => void;
}

function currencyFormat(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Componente compartilhado entre o diálogo de contratação (ficha do
 * paciente) e a seção "Plano inicial" do formulário de novo paciente —
 * conteúdo remontado via `key` a cada abertura, mesmo padrão do diálogo de
 * consulta, para não precisar de useEffect resetando estado.
 */
export function TreatmentCycleFormDialog({ open, onOpenChange, patientId, onCreated }: TreatmentCycleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <TreatmentCycleFormBody
          key={open ? patientId : 'closed'}
          patientId={patientId}
          onOpenChange={onOpenChange}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}

function TreatmentCycleFormBody({
  patientId,
  onOpenChange,
  onCreated,
}: Omit<TreatmentCycleFormDialogProps, 'open'>) {
  const { accessToken } = useTenantAuth();
  const queryClient = useQueryClient();

  const plansQuery = useQuery({
    queryKey: ['plans', { isActive: true }],
    queryFn: () => listPlans(accessToken!, { isActive: true, pageSize: 100 }),
    enabled: !!accessToken,
  });
  const paymentMethodsQuery = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => listPaymentMethods(accessToken!),
    enabled: !!accessToken,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CycleFormInput, unknown, CycleFormOutput>({
    resolver: zodResolver(cycleSchema),
    defaultValues: {
      planId: '',
      startDate: todayLocalDateKey(),
      discountType: 'PERCENTAGE',
      discountValue: 0,
      paymentMethodId: '',
      notes: '',
    },
  });

  const values = useWatch({ control });
  const selectedPlan = plansQuery.data?.data.find((p) => p.id === values.planId);

  const preview = (() => {
    if (!selectedPlan) return 'Selecione um plano para ver o valor final.';
    const basePrice = Number(selectedPlan.defaultPrice);
    const discountValue = Number(values.discountValue) || 0;
    const discountAmount =
      values.discountType === 'PERCENTAGE' ? (basePrice * discountValue) / 100 : discountValue;
    const finalValue = Math.max(basePrice - discountAmount, 0);
    return discountValue > 0
      ? `Preço-base ${currencyFormat(basePrice)} − desconto ${currencyFormat(discountAmount)} = valor final ${currencyFormat(finalValue)}`
      : `Valor final: ${currencyFormat(basePrice)} (sem desconto)`;
  })();

  async function onSubmit(formValues: CycleFormOutput) {
    if (!accessToken) return;
    try {
      await createTreatmentCycle(accessToken, patientId, {
        planId: formValues.planId,
        startDate: formValues.startDate,
        discountType: formValues.discountType,
        discountValue: formValues.discountValue,
        paymentMethodId: formValues.paymentMethodId || undefined,
        notes: formValues.notes || undefined,
      });
      toast.success('Contratação registrada com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['patient-treatment-cycles', patientId] });
      onOpenChange(false);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível registrar a contratação');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nova contratação</DialogTitle>
        <DialogDescription>Vincule um plano a este paciente, com desconto e forma de pagamento opcionais</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Plano *</Label>
          <Select
            value={values.planId ?? ''}
            onValueChange={(v) => v && setValue('planId', v, { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um plano" />
            </SelectTrigger>
            <SelectContent>
              {plansQuery.data?.data.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name} — {currencyFormat(Number(plan.defaultPrice))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.planId && <p className="text-sm text-destructive">{errors.planId.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="startDate">Data de início *</Label>
          <Input id="startDate" type="date" {...register('startDate')} />
          {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Desconto</Label>
          <div className="flex gap-2">
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={values.discountType === 'FIXED' ? 'default' : 'outline'}
                onClick={() => setValue('discountType', 'FIXED')}
                disabled={selectedPlan ? !selectedPlan.allowsDiscount : false}
              >
                R$
              </Button>
              <Button
                type="button"
                size="sm"
                variant={values.discountType === 'PERCENTAGE' ? 'default' : 'outline'}
                onClick={() => setValue('discountType', 'PERCENTAGE')}
                disabled={selectedPlan ? !selectedPlan.allowsDiscount : false}
              >
                %
              </Button>
            </div>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="flex-1"
              disabled={selectedPlan ? !selectedPlan.allowsDiscount : false}
              {...register('discountValue')}
            />
          </div>
          {selectedPlan && !selectedPlan.allowsDiscount && (
            <p className="text-xs text-muted-foreground">Este plano não permite desconto.</p>
          )}
          {errors.discountValue && <p className="text-sm text-destructive">{errors.discountValue.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Forma de pagamento</Label>
          <Select
            value={values.paymentMethodId ?? ''}
            onValueChange={(v) => setValue('paymentMethodId', v ?? undefined)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {paymentMethodsQuery.data?.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {method.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" rows={2} {...register('notes')} />
        </div>

        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{preview}</div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !values.planId}>
            {isSubmitting ? 'Salvando...' : 'Registrar contratação'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
