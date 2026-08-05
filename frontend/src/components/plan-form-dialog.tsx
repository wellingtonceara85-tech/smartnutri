'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import { createPlan, updatePlan } from '@/lib/api/plans';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Plan } from '@/lib/types';

const planSchema = z.object({
  name: z.string().min(2, 'Informe o nome do plano'),
  description: z.string().optional().or(z.literal('')),
  durationMonths: z.coerce.number().int().min(1, 'Deve ser maior que zero'),
  suggestedAppointments: z.coerce.number().int().min(1, 'Deve ser maior que zero'),
  suggestedIntervalDays: z.coerce.number().int().min(1, 'Deve ser maior que zero'),
  defaultPrice: z.coerce.number().min(0, 'Não pode ser negativo'),
  defaultInstallments: z.coerce.number().int().min(1, 'Deve ser maior que zero'),
  notes: z.string().optional().or(z.literal('')),
});

type PlanFormInput = z.input<typeof planSchema>;
type PlanFormOutput = z.output<typeof planSchema>;

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: Plan;
}

function currencyFormat(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildPlanPreview(values: Partial<PlanFormInput>): string {
  const durationMonths = Number(values.durationMonths) || 0;
  const suggestedAppointments = Number(values.suggestedAppointments) || 0;
  const suggestedIntervalDays = Number(values.suggestedIntervalDays) || 0;
  const defaultPrice = Number(values.defaultPrice) || 0;
  const defaultInstallments = Number(values.defaultInstallments) || 0;

  return (
    `Plano com duração de ${durationMonths} ${durationMonths === 1 ? 'mês' : 'meses'}, ` +
    `${suggestedAppointments} consulta${suggestedAppointments === 1 ? '' : 's'} sugerida${suggestedAppointments === 1 ? '' : 's'} ` +
    `a cada ${suggestedIntervalDays} dias, valor padrão de ${currencyFormat(defaultPrice)} ` +
    `em até ${defaultInstallments} parcela${defaultInstallments === 1 ? '' : 's'}.`
  );
}

export function PlanFormDialog({ open, onOpenChange, plan }: PlanFormDialogProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = !!plan;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormInput, unknown, PlanFormOutput>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      description: '',
      durationMonths: 3,
      suggestedAppointments: 3,
      suggestedIntervalDays: 30,
      defaultPrice: 0,
      defaultInstallments: 1,
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        plan
          ? {
              name: plan.name,
              description: plan.description ?? '',
              durationMonths: plan.durationMonths,
              suggestedAppointments: plan.suggestedAppointments,
              suggestedIntervalDays: plan.suggestedIntervalDays,
              defaultPrice: Number(plan.defaultPrice),
              defaultInstallments: plan.defaultInstallments,
              notes: plan.notes ?? '',
            }
          : {
              name: '',
              description: '',
              durationMonths: 3,
              suggestedAppointments: 3,
              suggestedIntervalDays: 30,
              defaultPrice: 0,
              defaultInstallments: 1,
              notes: '',
            },
      );
    }
  }, [open, plan, reset]);

  const values = useWatch({ control });

  async function onSubmit(formValues: PlanFormOutput) {
    if (!accessToken) return;
    try {
      if (isEdit && plan) {
        await updatePlan(accessToken, plan.id, formValues);
        toast.success('Plano atualizado com sucesso');
      } else {
        await createPlan(accessToken, formValues);
        toast.success('Plano cadastrado com sucesso');
      }
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível salvar o plano');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar plano' : 'Novo plano'}</DialogTitle>
          <DialogDescription>Configure a duração, consultas sugeridas e valores do plano</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" rows={2} {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="durationMonths">Duração (meses) *</Label>
              <Input id="durationMonths" type="number" min={1} {...register('durationMonths')} />
              {errors.durationMonths && <p className="text-sm text-destructive">{errors.durationMonths.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="suggestedAppointments">Consultas sugeridas *</Label>
              <Input id="suggestedAppointments" type="number" min={1} {...register('suggestedAppointments')} />
              {errors.suggestedAppointments && <p className="text-sm text-destructive">{errors.suggestedAppointments.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="suggestedIntervalDays">Intervalo (dias) *</Label>
              <Input id="suggestedIntervalDays" type="number" min={1} {...register('suggestedIntervalDays')} />
              {errors.suggestedIntervalDays && <p className="text-sm text-destructive">{errors.suggestedIntervalDays.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="defaultInstallments">Parcelas padrão *</Label>
              <Input id="defaultInstallments" type="number" min={1} {...register('defaultInstallments')} />
              {errors.defaultInstallments && <p className="text-sm text-destructive">{errors.defaultInstallments.message}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="defaultPrice">Valor padrão (R$) *</Label>
            <Input id="defaultPrice" type="number" min={0} step="0.01" {...register('defaultPrice')} />
            {errors.defaultPrice && <p className="text-sm text-destructive">{errors.defaultPrice.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </div>

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{buildPlanPreview(values)}</div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar plano'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
