'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { listPlatformTenants } from '@/lib/api/platform';
import { usePlatformAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';
import {
  TENANT_STATUS_LABELS,
  TENANT_TYPE_LABELS,
  type TenantStatus,
  type TenantType,
} from '@/lib/types';

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<TenantStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  TRIAL: 'outline',
  ACTIVE: 'default',
  SUSPENDED: 'destructive',
  CANCELLED: 'secondary',
};

export default function PlatformClientesPage() {
  const { accessToken } = usePlatformAuth();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TenantStatus | 'ALL'>('ALL');
  const [type, setType] = useState<TenantType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const tenantsQuery = useQuery({
    queryKey: ['platform-tenants', search, status, type, page],
    queryFn: () =>
      listPlatformTenants(accessToken!, {
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
        type: type === 'ALL' ? undefined : type,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!accessToken,
  });

  const totalPages = useMemo(() => {
    if (!tenantsQuery.data) return 1;
    return Math.max(1, Math.ceil(tenantsQuery.data.total / PAGE_SIZE));
  }, [tenantsQuery.data]);

  const tenants = tenantsQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Nutricionistas independentes e clínicas cadastrados no SmartNutri</p>
        </div>
        <Button nativeButton={false} render={<Link href="/platform/clientes/novo" />}>
          <Plus className="size-4" />
          Novo cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Busque por nome ou e-mail do cliente</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar cliente..."
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus((v as TenantStatus | 'ALL') ?? 'ALL');
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Status">
                {(v: string) => (v === 'ALL' ? 'Todos os status' : TENANT_STATUS_LABELS[v as TenantStatus])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {Object.entries(TENANT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(v) => {
              setType((v as TenantType | 'ALL') ?? 'ALL');
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Tipo">
                {(v: string) => (v === 'ALL' ? 'Todos os tipos' : TENANT_TYPE_LABELS[v as TenantType])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os tipos</SelectItem>
              {Object.entries(TENANT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {tenantsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tenants.map((tenant) => (
            <Link key={tenant.id} href={`/platform/clientes/${tenant.id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{tenant.name}</p>
                      <Badge variant={STATUS_BADGE_VARIANT[tenant.status]}>{TENANT_STATUS_LABELS[tenant.status]}</Badge>
                      <Badge variant="outline">{TENANT_TYPE_LABELS[tenant.type]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tenant.responsibleName ?? 'Responsável não configurado'} · {tenant.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground sm:text-right">
                    <div>
                      <p className="font-medium text-foreground">{tenant.userCount}</p>
                      <p>usuário{tenant.userCount === 1 ? '' : 's'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{tenant.patientCount}</p>
                      <p>paciente{tenant.patientCount === 1 ? '' : 's'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{formatCalendarDate(tenant.createdAt)}</p>
                      <p>cadastro</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {tenantsQuery.data && tenantsQuery.data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {tenantsQuery.data.total} cliente{tenantsQuery.data.total === 1 ? '' : 's'} — página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
