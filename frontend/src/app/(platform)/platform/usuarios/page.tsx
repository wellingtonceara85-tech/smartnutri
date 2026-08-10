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
import { listPlatformTenants, listPlatformUsers } from '@/lib/api/platform';
import { usePlatformAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';
import {
  PLATFORM_ROLE_LABELS,
  TENANT_STATUS_LABELS,
  TENANT_TYPE_LABELS,
  type PlatformRole,
  type TenantType,
} from '@/lib/types';

const PAGE_SIZE = 20;

export default function PlatformUsuariosPage() {
  const { accessToken } = usePlatformAuth();

  const [search, setSearch] = useState('');
  const [tenantId, setTenantId] = useState<string>('ALL');
  const [role, setRole] = useState<PlatformRole | 'ALL'>('ALL');
  const [isActive, setIsActive] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [tenantType, setTenantType] = useState<TenantType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const tenantsQuery = useQuery({
    queryKey: ['platform-tenants-options'],
    queryFn: () => listPlatformTenants(accessToken!, { pageSize: 100 }),
    enabled: !!accessToken,
  });

  const usersQuery = useQuery({
    queryKey: ['platform-users', search, tenantId, role, isActive, tenantType, page],
    queryFn: () =>
      listPlatformUsers(accessToken!, {
        search: search || undefined,
        tenantId: tenantId === 'ALL' ? undefined : tenantId,
        role: role === 'ALL' ? undefined : role,
        isActive: isActive === 'ALL' ? undefined : isActive === 'true',
        tenantType: tenantType === 'ALL' ? undefined : tenantType,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!accessToken,
  });

  const totalPages = useMemo(() => {
    if (!usersQuery.data) return 1;
    return Math.max(1, Math.ceil(usersQuery.data.total / PAGE_SIZE));
  }, [usersQuery.data]);

  const users = usersQuery.data?.data ?? [];
  const tenantOptions = tenantsQuery.data?.data ?? [];

  function resetPageAnd<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">Usuários de todos os clientes cadastrados no SmartNutri</p>
        </div>
        <Button nativeButton={false} render={<Link href="/platform/usuarios/novo" />}>
          <Plus className="size-4" />
          Novo usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Busque por nome, e-mail ou nome do cliente</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => resetPageAnd(setSearch)(e.target.value)}
              placeholder="Buscar usuário..."
              className="pl-9"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={tenantId} onValueChange={(v) => resetPageAnd(setTenantId)(v ?? 'ALL')}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente">
                  {(v: string) => (v === 'ALL' ? 'Todos os clientes' : (tenantOptions.find((t) => t.id === v)?.name ?? ''))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os clientes</SelectItem>
                {tenantOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(v) => resetPageAnd(setRole)((v as PlatformRole | 'ALL') ?? 'ALL')}>
              <SelectTrigger>
                <SelectValue placeholder="Perfil">
                  {(v: string) => (v === 'ALL' ? 'Todos os perfis' : PLATFORM_ROLE_LABELS[v as PlatformRole])}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os perfis</SelectItem>
                {Object.entries(PLATFORM_ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={isActive} onValueChange={(v) => resetPageAnd(setIsActive)((v as typeof isActive) ?? 'ALL')}>
              <SelectTrigger>
                <SelectValue placeholder="Status">
                  {(v: string) => (v === 'ALL' ? 'Todos os status' : v === 'true' ? 'Ativo' : 'Suspenso')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="true">Ativo</SelectItem>
                <SelectItem value="false">Suspenso</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tenantType} onValueChange={(v) => resetPageAnd(setTenantType)((v as TenantType | 'ALL') ?? 'ALL')}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de cliente">
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
          </div>
        </CardContent>
      </Card>

      {usersQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <Link key={user.id} href={`/platform/usuarios/${user.id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{user.name}</p>
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>{user.isActive ? 'Ativo' : 'Suspenso'}</Badge>
                      <Badge variant="outline">{PLATFORM_ROLE_LABELS[user.role]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.tenantName} · {TENANT_TYPE_LABELS[user.tenantType]} ·{' '}
                      <span className={user.tenantStatus === 'SUSPENDED' ? 'text-destructive' : undefined}>
                        {TENANT_STATUS_LABELS[user.tenantStatus]}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground sm:text-right">
                    <div>
                      <p className="font-medium text-foreground">{formatCalendarDate(user.createdAt)}</p>
                      <p>cadastro</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user.lastLoginAt ? formatCalendarDate(user.lastLoginAt) : '—'}</p>
                      <p>último acesso</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {usersQuery.data && usersQuery.data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {usersQuery.data.total} usuário{usersQuery.data.total === 1 ? '' : 's'} — página {page} de {totalPages}
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
