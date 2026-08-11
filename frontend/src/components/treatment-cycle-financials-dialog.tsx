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
import { updateTreatmentCycleFinancials } from '@/lib/api/treatment-cycles';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import type { TreatmentCycle } from '@/lib/types';

const financialsSchema = z.object({
  contractedValue: z.coerce.number().min(0, 'Não pode ser negativo'),
  discountType: z.enum(['FIXED', 'PERCENTAGE']),
  discountValue: z.coerce.number().min(0, 'Não pode ser negativo'),
  paymentMethodId: z.string().optional(),
  downPayment: z.coerce.number().min(0, 'Não pode ser negativo'),
  installmentCount: z.coerce.number().int().min(1, 'Mínimo de 1 parcela'),
  reason: z.string().min(3, 'Informe o motivo da correção (mínimo 3 caracteres)'),
});

type FinancialsFormInput = z.input<typeof financialsSchema>;
type FinancialsFormOutput = z.output<typeof financialsSchema>;

interface TreatmentCycleFinancialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: TreatmentCycle;
  patientId: string;
}

function currencyFormat(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Correção de valores de uma contratação já confirmada — não recria o
 * ciclo, apenas ajusta os campos financeiros com motivo obrigatório,
 * registrado no AuditLog (Missão 0005.8, ajuste final, item 4).
 */
export function TreatmentCycleFinancialsDialog({
  open,
  onOpenChange,
  cycle,
  patientId,
}: TreatmentCycleFinancialsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <TreatmentCycleFinancialsBody
          key={open ? cycle.id : 'closed'}
          cycle={cycle}
          patientId={patientId}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function TreatmentCycleFinancialsBody({
  cycle,
  patientId,
  onOpenChange,
}: Omit<TreatmentCycleFinancialsDialogProps, 'open'>) {
  const { accessToken } = useTenantAuth();
  const queryClient = useQueryClient();

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
  } = useForm<FinancialsFormInput, unknown, FinancialsFormOutput>({
    resolver: zodResolver(financialsSchema),
    defaultValues: {
      contractedValue: Number(cycle.contractedValue),
      discountType: cycle.discountType,
      discountValue: Number(cycle.discountValue),
      paymentMethodId: cycle.paymentMethod?.id ?? '',
      downPayment: Number(cycle.downPayment),
      installmentCount: cycle.installmentCount,
      reason: '',
    },
  });

  const values = useWatch({ control });

  const preview = (() => {
    const basePrice = Number(values.contractedValue) || 0;
    const discountValue = Number(values.discountValue) || 0;
    const discountAmount =
      values.discountType === 'PERCENTAGE' ? (basePrice * discountValue) / 100 : discountValue;
    const finalValue = Math.max(basePrice - discountAmount, 0);
    return `Preço-base ${currencyFormat(basePrice)} − desconto ${currencyFormat(discountAmount)} = valor final ${currencyFormat(finalValue)}`;
  })();

  async function onSubmit(formValues: FinancialsFormOutput) {
    if (!accessToken) return;
    try {
      await updateTreatmentCycleFinancials(accessToken, cycle.id, {
        contractedValue: formValues.contractedValue,
        discountType: formValues.discountType,
        discountValue: formValues.discountValue,
        paymentMethodId: formValues.paymentMethodId || null,
        downPayment: formValues.downPayment,
        installmentCount: formValues.installmentCount,
        reason: formValues.reason,
      });
      toast.success('Valores da contratação corrigidos com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['patient-treatment-cycles', patientId] });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível corrigir os valores');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Corrigir valores da contratação</DialogTitle>
        <DialogDescription>
          Ajuste os valores financeiros desta contratação sem cancelar e recriar o registro. A alteração fica
          registrada no histórico, com motivo obrigatório.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="contractedValue">Valor contratado *</Label>
          <Input id="contractedValue" type="number" min={0} step="0.01" {...register('contractedValue')} />
          {errors.contractedValue && <p className="text-sm text-destructive">{errors.contractedValue.message}</p>}
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
              >
                R$
              </Button>
              <Button
                type="button"
                size="sm"
                variant={values.discountType === 'PERCENTAGE' ? 'default' : 'outline'}
                onClick={() => setValue('discountType', 'PERCENTAGE')}
              >
                %
              </Button>
            </div>
            <Input type="number" min={0} step="0.01" className="flex-1" {...register('discountValue')} />
          </div>
          {errors.discountValue && <p className="text-sm text-destructive">{errors.discountValue.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Forma de pagamento</Label>
          <Select
            value={values.paymentMethodId ?? ''}
            onValueChange={(v) => setValue('paymentMethodId', v ?? undefined)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione (opcional)">
                {(v: string) => paymentMethodsQuery.data?.find((m) => m.id === v)?.name ?? ''}
              </SelectValue>
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

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="downPayment">Entrada</Label>
            <Input id="downPayment" type="number" min={0} step="0.01" {...register('downPayment')} />
            {errors.downPayment && <p className="text-sm text-destructive">{errors.downPayment.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="installmentCount">Parcelas</Label>
            <Input id="installmentCount" type="number" min={1} step="1" {...register('installmentCount')} />
            {errors.installmentCount && (
              <p className="text-sm text-destructive">{errors.installmentCount.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">Motivo da correção *</Label>
          <Textarea id="reason" rows={2} placeholder="Ex.: valor lançado errado na contratação original" {...register('reason')} />
          {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
        </div>

        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{preview}</div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar correção'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
