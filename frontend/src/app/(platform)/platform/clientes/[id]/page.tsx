'use client';

import { use, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Play, Repeat } from 'lucide-react';
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
import {
  activatePlatformTenant,
  changeTenantPlan,
  getPlatformTenant,
  listPlatformPlans,
  listPlatformTenantUsers,
  suspendPlatformTenant,
} from '@/lib/api/platform';
import { ApiError } from '@/lib/api-client';
import { usePlatformAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';
import { TENANT_STATUS_LABELS, TENANT_TYPE_LABELS, type PlanCode, type TenantStatus } from '@/lib/types';

const STATUS_BADGE_VARIANT: Record<TenantStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  TRIAL: 'outline',
  ACTIVE: 'default',
  SUSPENDED: 'destructive',
  CANCELLED: 'secondary',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador(a)',
  NUTRITIONIST: 'Nutricionista',
  RECEPTION: 'Recepção',
};

export default function PlatformClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken } = usePlatformAuth();
  const queryClient = useQueryClient();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanCode | ''>('');
  const [busy, setBusy] = useState(false);

  const tenantQuery = useQuery({
    queryKey: ['platform-tenant', id],
    queryFn: () => getPlatformTenant(accessToken!, id),
    enabled: !!accessToken,
  });

  const usersQuery = useQuery({
    queryKey: ['platform-tenant-users', id],
    queryFn: () => listPlatformTenantUsers(accessToken!, id),
    enabled: !!accessToken,
  });

  const plansQuery = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => listPlatformPlans(accessToken!),
    enabled: !!accessToken,
  });

  // Troca de plano é ação do Platform Admin — pode incluir planos internos (ex.: DEMO_INTERNAL), diferente da criação normal de cliente.
  const changeablePlans = useMemo(
    () => (plansQuery.data ?? []).filter((plan) => plan.tenantType === tenantQuery.data?.type),
    [plansQuery.data, tenantQuery.data?.type],
  );

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['platform-tenant', id] });
    await queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
  }

  async function handleActivate() {
    if (!accessToken) return;
    setBusy(true);
    try {
      await activatePlatformTenant(accessToken, id);
      toast.success('Cliente ativado');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível ativar o cliente');
    } finally {
      setBusy(false);
    }
  }

  async function handleSuspend() {
    if (!accessToken) return;
    setBusy(true);
    try {
      await suspendPlatformTenant(accessToken, id);
      toast.success('Cliente suspenso — nenhum dado foi apagado');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível suspender o cliente');
    } finally {
      setBusy(false);
      setSuspendOpen(false);
    }
  }

  function openChangePlan() {
    setSelectedPlan(tenantQuery.data?.plan.code ?? '');
    setChangePlanOpen(true);
  }

  async function handleChangePlan() {
    if (!accessToken || !selectedPlan) return;
    setBusy(true);
    try {
      await changeTenantPlan(accessToken, id, { planCode: selectedPlan });
      toast.success('Plano alterado');
      await invalidate();
      setChangePlanOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível alterar o plano');
    } finally {
      setBusy(false);
    }
  }

  if (tenantQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (tenantQuery.isError || !tenantQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 p-12 text-center">
        <p className="font-medium">Não foi possível carregar o cliente</p>
      </div>
    );
  }

  const tenant = tenantQuery.data;
  const users = usersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <Badge variant={STATUS_BADGE_VARIANT[tenant.status]}>{TENANT_STATUS_LABELS[tenant.status]}</Badge>
            <Badge variant="outline">{TENANT_TYPE_LABELS[tenant.type]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {tenant.responsibleName ?? 'Responsável não configurado'} · {tenant.email} · {tenant.phone}
          </p>
          <p className="text-xs text-muted-foreground">Cadastrado em {formatCalendarDate(tenant.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tenant.status === 'SUSPENDED' ? (
            <Button onClick={handleActivate} disabled={busy}>
              <Play className="size-4" />
              Reativar cliente
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setSuspendOpen(true)} disabled={busy}>
              <Ban className="size-4" />
              Suspender cliente
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-2xl font-bold tracking-tight">
              {tenant.usage.users} / {tenant.usage.maxUsers}
            </p>
            <p className="text-sm text-muted-foreground">Usuários</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-2xl font-bold tracking-tight">{tenant.usage.nutritionists}</p>
            <p className="text-sm text-muted-foreground">Nutricionistas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-2xl font-bold tracking-tight">{tenant.usage.patients}</p>
            <p className="text-sm text-muted-foreground">Pacientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-2xl font-bold tracking-tight">{tenant.usage.appointments}</p>
            <p className="text-sm text-muted-foreground">Consultas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Plano e vigência</CardTitle>
          <Button variant="outline" size="sm" onClick={openChangePlan} disabled={busy}>
            <Repeat className="size-4" />
            Trocar plano
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Plano</p>
            <p className="font-medium">
              {tenant.plan.displayName}
              {tenant.plan.isInternal && <span className="ml-2 text-xs text-muted-foreground">(uso interno)</span>}
            </p>
          </div>
          {tenant.trialEndsAt && (
            <div>
              <p className="text-muted-foreground">Fim do trial</p>
              <p className="font-medium">{formatCalendarDate(tenant.trialEndsAt)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários deste cliente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
          ) : (
            users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  <Badge variant={u.isActive ? 'default' : 'secondary'}>{u.isActive ? 'Ativo' : 'Inativo'}</Badge>
                  {u.lastLoginAt && (
                    <span className="text-xs text-muted-foreground">Último acesso {formatCalendarDate(u.lastLoginAt)}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Nenhum dado será apagado. Os usuários deste cliente verão uma mensagem informando que o acesso está
              temporariamente suspenso ao tentar entrar. Você pode reativar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend}>Suspender</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar plano</DialogTitle>
            <DialogDescription>
              Se a equipe atual não couber no plano novo, a troca será bloqueada até a equipe ser reduzida — nenhum
              usuário é suspenso automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {changeablePlans.map((plan) => (
              <button
                key={plan.code}
                type="button"
                onClick={() => setSelectedPlan(plan.code)}
                className={
                  'flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors ' +
                  (selectedPlan === plan.code ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/40')
                }
              >
                <span className="font-medium">
                  {plan.displayName}
                  {plan.isInternal && <span className="ml-2 text-xs text-muted-foreground">(uso interno)</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  até {plan.maxUsers} usuário{plan.maxUsers === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleChangePlan} disabled={busy || !selectedPlan || selectedPlan === tenant.plan.code}>
              {busy ? 'Salvando...' : 'Confirmar troca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
