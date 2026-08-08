'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, GitBranch, Pencil, Play, Printer, Share2, Square, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  activateMealPlan,
  archiveMealPlan,
  completeMealPlan,
  createNewMealPlanVersion,
  duplicateMealPlan,
  getMealPlan,
  shareMealPlan,
} from '@/lib/api/meal-plans';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';
import { MEAL_PLAN_STATUS_LABELS, type MealPlanStatus } from '@/lib/types';

const STATUS_VARIANT: Record<MealPlanStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  ACTIVE: 'default',
  REPLACED: 'secondary',
  COMPLETED: 'secondary',
  ARCHIVED: 'secondary',
};

export default function PlanoAlimentarDetailPage({ params }: { params: Promise<{ id: string; mealPlanId: string }> }) {
  const { id, mealPlanId } = use(params);
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareChecked, setShareChecked] = useState(false);
  const [shareNotes, setShareNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const mealPlanQuery = useQuery({
    queryKey: ['meal-plan', mealPlanId],
    queryFn: () => getMealPlan(accessToken!, mealPlanId),
    enabled: !!accessToken,
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['meal-plan', mealPlanId] });
    await queryClient.invalidateQueries({ queryKey: ['meal-plans', id] });
  }

  async function handleActivate() {
    if (!accessToken) return;
    setBusy(true);
    try {
      await activateMealPlan(accessToken, mealPlanId);
      toast.success('Plano ativado — o plano anterior foi marcado como substituído');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível ativar o plano');
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!accessToken) return;
    setBusy(true);
    try {
      await completeMealPlan(accessToken, mealPlanId);
      toast.success('Plano marcado como concluído');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível concluir o plano');
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    if (!accessToken) return;
    setBusy(true);
    try {
      const copy = await duplicateMealPlan(accessToken, mealPlanId);
      toast.success('Cópia independente criada');
      window.location.href = `/pacientes/${id}/plano-alimentar/${copy.id}`;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível duplicar o plano');
      setBusy(false);
    }
  }

  async function handleNewVersion() {
    if (!accessToken) return;
    setBusy(true);
    try {
      const nextVersion = await createNewMealPlanVersion(accessToken, mealPlanId);
      toast.success('Nova versão criada — o plano original permanece intocado até você ativar a nova versão');
      window.location.href = `/pacientes/${id}/plano-alimentar/${nextVersion.id}/editar`;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível criar uma nova versão');
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!accessToken) return;
    try {
      await archiveMealPlan(accessToken, mealPlanId);
      toast.success('Plano arquivado');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível arquivar o plano');
    } finally {
      setArchiveOpen(false);
    }
  }

  async function handleShareToggle(next: boolean) {
    if (!accessToken || !mealPlanQuery.data) return;
    try {
      await shareMealPlan(accessToken, mealPlanId, next, shareNotes || mealPlanQuery.data.patientVisibleNotes || undefined);
      toast.success(next ? 'Plano marcado como compartilhado' : 'Compartilhamento removido');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível atualizar o compartilhamento');
    }
  }

  if (mealPlanQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (mealPlanQuery.isError || !mealPlanQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 p-12 text-center">
        <p className="font-medium">Não foi possível carregar o plano alimentar</p>
        <p className="text-sm text-muted-foreground">
          {mealPlanQuery.error instanceof ApiError ? mealPlanQuery.error.message : 'Tente novamente em instantes.'}
        </p>
      </div>
    );
  }

  const plan = mealPlanQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{plan.title}</h1>
            <Badge variant={STATUS_VARIANT[plan.status]}>{MEAL_PLAN_STATUS_LABELS[plan.status]}</Badge>
            <Badge variant="outline">v{plan.version}</Badge>
            {plan.isSharedWithPatient && (
              <Badge variant="secondary">
                <Share2 className="size-3" />
                Compartilhado
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {plan.objective && `${plan.objective} · `}
            Válido a partir de {formatCalendarDate(plan.effectiveFrom)}
            {plan.effectiveUntil && ` até ${formatCalendarDate(plan.effectiveUntil)}`}
            {' · '}
            {plan.nutritionistUser.name}
          </p>
          {plan.appointment && (
            <p className="text-xs text-muted-foreground">
              Criado na consulta de {formatCalendarDate(plan.appointment.scheduledAt)} ({plan.appointment.appointmentType.name})
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href={`/pacientes/${id}/plano-alimentar/${plan.id}/imprimir`} />}>
            <Printer className="size-4" />
            Imprimir
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={`/pacientes/${id}/plano-alimentar/${plan.id}/editar`} />}>
            <Pencil className="size-4" />
            Editar
          </Button>
          {plan.status === 'DRAFT' && (
            <Button onClick={handleActivate} disabled={busy}>
              <Play className="size-4" />
              Ativar
            </Button>
          )}
          {plan.status === 'ACTIVE' && (
            <Button variant="outline" onClick={handleComplete} disabled={busy}>
              <Square className="size-4" />
              Concluir
            </Button>
          )}
          <Button variant="outline" onClick={handleDuplicate} disabled={busy}>
            <Copy className="size-4" />
            Duplicar
          </Button>
          <Button variant="outline" onClick={handleNewVersion} disabled={busy}>
            <GitBranch className="size-4" />
            Nova versão
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShareChecked(plan.isSharedWithPatient);
              setShareNotes(plan.patientVisibleNotes ?? '');
              setShareOpen(true);
            }}
          >
            <Share2 className="size-4" />
            Compartilhar
          </Button>
          {plan.status !== 'ARCHIVED' && (
            <Button variant="outline" onClick={() => setArchiveOpen(true)}>
              <Trash2 className="size-4" />
              Arquivar
            </Button>
          )}
        </div>
      </div>

      {plan.generalGuidelines && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orientações gerais</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{plan.generalGuidelines}</CardContent>
        </Card>
      )}

      {plan.dailyWaterGoalMl && (
        <p className="text-sm text-muted-foreground">Meta diária de água: {plan.dailyWaterGoalMl} ml</p>
      )}

      <div className="flex flex-col gap-4">
        {plan.meals.map((meal) => (
          <Card key={meal.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {meal.name}
                {(meal.scheduledTime || meal.timeDescription) && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {meal.scheduledTime ?? meal.timeDescription}
                  </span>
                )}
              </CardTitle>
              {meal.instructions && <p className="text-sm text-muted-foreground">{meal.instructions}</p>}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {meal.items.map((item) => (
                <div key={item.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {item.description}
                    {(item.quantity || item.unit || item.householdMeasure) && (
                      <span className="text-muted-foreground">
                        {' — '}
                        {[item.quantity, item.unit].filter(Boolean).join(' ')}
                        {item.householdMeasure ? ` (${item.householdMeasure})` : ''}
                      </span>
                    )}
                  </p>
                  {item.instructions && <p className="text-muted-foreground">{item.instructions}</p>}
                  {item.substitutions.length > 0 && (
                    <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">
                      <p className="text-xs font-medium">Substituir por:</p>
                      <ul className="list-inside list-disc">
                        {item.substitutions.map((sub) => (
                          <li key={sub.id}>
                            {sub.description}
                            {(sub.quantity || sub.unit) && ` — ${[sub.quantity, sub.unit].filter(Boolean).join(' ')}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {plan.internalNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nota interna</CardTitle>
            <p className="text-xs text-muted-foreground">Visível apenas para a equipe — nunca aparece na impressão ou para o paciente.</p>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{plan.internalNotes}</CardContent>
        </Card>
      )}

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar plano alimentar</AlertDialogTitle>
            <AlertDialogDescription>
              O plano deixará de aparecer na listagem ativa, mas o histórico é mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhamento com o paciente</DialogTitle>
            <DialogDescription>
              Prepara o plano para o futuro Portal do Paciente. Nunca inclui a nota interna.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4"
                checked={shareChecked}
                onChange={(e) => setShareChecked(e.target.checked)}
              />
              Compartilhado com o paciente
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Mensagem ao paciente</span>
              <Textarea value={shareNotes} onChange={(e) => setShareNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                await handleShareToggle(shareChecked);
                setShareOpen(false);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
