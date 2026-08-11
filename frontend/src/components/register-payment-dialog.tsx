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
import { registerPayment } from '@/lib/api/finance';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import { todayLocalDateKey } from '@/lib/appointment-datetime';
import type { Charge } from '@/lib/types';

const schema = z.object({
  paymentMethodId: z.string().min(1, 'Selecione a forma de pagamento'),
  amount: z.coerce.number().min(0.01, 'Informe um valor maior que zero'),
  paidAt: z.string().min(1, 'Informe a data do pagamento'),
  referenceNote: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge: Charge;
}

function currencyFormat(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Remontado via `key` a cada abertura — mesmo padrão dos demais diálogos do projeto. */
export function RegisterPaymentDialog({ open, onOpenChange, charge }: RegisterPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <RegisterPaymentBody key={open ? charge.id : 'closed'} charge={charge} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function RegisterPaymentBody({
  charge,
  onOpenChange,
}: Omit<RegisterPaymentDialogProps, 'open'>) {
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
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      paymentMethodId: '',
      amount: Number(charge.remaining),
      paidAt: todayLocalDateKey(),
      referenceNote: '',
    },
  });
  const values = useWatch({ control });

  async function onSubmit(formValues: FormOutput) {
    if (!accessToken) return;
    try {
      await registerPayment(accessToken, {
        chargeId: charge.id,
        paymentMethodId: formValues.paymentMethodId,
        amount: formValues.amount,
        paidAt: formValues.paidAt,
        referenceNote: formValues.referenceNote || undefined,
      });
      toast.success('Pagamento registrado com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['finance-charges'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível registrar o pagamento');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Registrar pagamento</DialogTitle>
        <DialogDescription>
          {charge.patient.fullName} — saldo restante {currencyFormat(Number(charge.remaining))}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Forma de pagamento *</Label>
          <Select
            value={values.paymentMethodId ?? ''}
            onValueChange={(v) => v && setValue('paymentMethodId', v, { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione">
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
          {errors.paymentMethodId && <p className="text-sm text-destructive">{errors.paymentMethodId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-amount">Valor pago *</Label>
            <Input id="pay-amount" type="number" min={0.01} step="0.01" {...register('amount')} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-date">Data do pagamento *</Label>
            <Input id="pay-date" type="date" {...register('paidAt')} />
            {errors.paidAt && <p className="text-sm text-destructive">{errors.paidAt.message}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="pay-note">Observação</Label>
          <Textarea id="pay-note" rows={2} {...register('referenceNote')} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Registrar pagamento'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
