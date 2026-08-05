'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlanFormDialog } from '@/components/plan-form-dialog';
import { listPlans, updatePlanStatus } from '@/lib/api/plans';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Plan } from '@/lib/types';

function currencyFormat(value: string) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PlanosPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | undefined>(undefined);

  const plansQuery = useQuery({
    queryKey: ['plans', { search, isActive }],
    queryFn: () =>
      listPlans(accessToken!, {
        search: search || undefined,
        isActive: isActive === 'ALL' ? undefined : isActive === 'true',
      }),
    enabled: !!accessToken,
  });

  function openCreateDialog() {
    setEditingPlan(undefined);
    setDialogOpen(true);
  }

  function openEditDialog(plan: Plan) {
    setEditingPlan(plan);
    setDialogOpen(true);
  }

  async function toggleStatus(plan: Plan) {
    if (!accessToken) return;
    try {
      await updatePlanStatus(accessToken, plan.id, !plan.isActive);
      toast.success(plan.isActive ? 'Plano inativado' : 'Plano ativado');
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível alterar o status do plano');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Planos</h1>
          <p className="text-muted-foreground">Catálogo de planos de acompanhamento nutricional</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreateDialog}>
            <Plus className="size-4" />
            Novo plano
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Busque pelo nome do plano</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar plano..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isAdmin && (
            <Select value={isActive} onValueChange={(v) => setIsActive(v as typeof isActive)}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Status">
                  {(value: string) => ({ ALL: 'Todos', true: 'Ativos', false: 'Inativos' })[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="true">Ativos</SelectItem>
                <SelectItem value="false">Inativos</SelectItem>
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {plansQuery.isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : plansQuery.isError ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <p className="font-medium">Não foi possível carregar os planos</p>
              <Button variant="outline" onClick={() => plansQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : plansQuery.data?.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <p className="font-medium">Nenhum plano encontrado</p>
              {isAdmin && <p className="text-sm text-muted-foreground">Cadastre o primeiro plano da clínica.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Consultas sugeridas</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Valor padrão</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plansQuery.data?.data.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>{plan.durationMonths} meses</TableCell>
                      <TableCell>{plan.suggestedAppointments}</TableCell>
                      <TableCell>{plan.suggestedIntervalDays} dias</TableCell>
                      <TableCell>{currencyFormat(plan.defaultPrice)}</TableCell>
                      <TableCell>{plan.defaultInstallments}x</TableCell>
                      <TableCell>
                        <Badge variant={plan.isActive ? 'default' : 'secondary'}>{plan.isActive ? 'Ativo' : 'Inativo'}</Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted">
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(plan)}>Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStatus(plan)}>
                                {plan.isActive ? 'Inativar' : 'Ativar'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && <PlanFormDialog open={dialogOpen} onOpenChange={setDialogOpen} plan={editingPlan} />}
    </div>
  );
}
