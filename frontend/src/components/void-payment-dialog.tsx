'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { voidPayment } from '@/lib/api/finance';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import type { Charge } from '@/lib/types';

const schema = z.object({
  reason: z.string().min(3, 'Informe o motivo da reversão (mínimo 3 caracteres)'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface VoidPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge: Charge;
}

/** Reverte um pagamento lançado por engano — nunca apaga histórico, só corrige com motivo
 * obrigatório (mesmo padrão de "corrigir valores" da contratação). */
export function VoidPaymentDialog({ open, onOpenChange, charge }: VoidPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <VoidPaymentBody key={open ? charge.id : 'closed'} charge={charge} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function VoidPaymentBody({ charge, onOpenChange }: Omit<VoidPaymentDialogProps, 'open'>) {
  const { accessToken } = useTenantAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  });

  async function onSubmit(values: FormOutput) {
    if (!accessToken || !charge.paymentId) return;
    try {
      await voidPayment(accessToken, charge.paymentId, values.reason);
      toast.success('Pagamento revertido com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['finance-charges'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível reverter o pagamento');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reverter pagamento</DialogTitle>
        <DialogDescription>
          {charge.patient.fullName} — a cobrança volta para pendente e o pagamento fica registrado como
          revertido no histórico, nunca apagado.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="void-reason">Motivo da reversão *</Label>
          <Textarea
            id="void-reason"
            rows={2}
            placeholder="Ex.: pagamento lançado por engano"
            {...register('reason')}
          />
          {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="destructive" disabled={isSubmitting}>
            {isSubmitting ? 'Revertendo...' : 'Reverter pagamento'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
