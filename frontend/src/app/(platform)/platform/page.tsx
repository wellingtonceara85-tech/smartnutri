'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Stethoscope, UsersRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getPlatformDashboard } from '@/lib/api/platform';
import { usePlatformAuth } from '@/lib/auth-context';

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformDashboardPage() {
  const { accessToken } = usePlatformAuth();

  const dashboardQuery = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: () => getPlatformDashboard(accessToken!),
    enabled: !!accessToken,
  });

  if (dashboardQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 p-12 text-center">
        <p className="font-medium">Não foi possível carregar a visão geral</p>
      </div>
    );
  }

  const data = dashboardQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Indicadores agregados de todos os clientes do SmartNutri</p>
        </div>
        <Button nativeButton={false} render={<Link href="/platform/clientes/novo" />}>
          Novo cliente
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Clientes totais" value={data.tenants.total} />
        <StatCard icon={Users} label="Pacientes na plataforma" value={data.patients} />
        <StatCard icon={Stethoscope} label="Nutricionistas cadastrados" value={data.nutritionists} />
        <StatCard icon={UsersRound} label="Usuários internos totais" value={data.internalUsers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes por status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xl font-semibold">{data.tenants.active}</p>
            <p className="text-sm text-muted-foreground">Ativos</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{data.tenants.trial}</p>
            <p className="text-sm text-muted-foreground">Em teste</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{data.tenants.suspended}</p>
            <p className="text-sm text-muted-foreground">Suspensos</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{data.tenants.cancelled}</p>
            <p className="text-sm text-muted-foreground">Cancelados</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes por tipo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xl font-semibold">{data.tenants.solo}</p>
            <p className="text-sm text-muted-foreground">Nutricionistas independentes</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{data.tenants.clinic}</p>
            <p className="text-sm text-muted-foreground">Clínicas</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
