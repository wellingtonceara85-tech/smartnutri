'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPlatformUser, listPlatformTenants } from '@/lib/api/platform';
import { ApiError } from '@/lib/api-client';
import { usePlatformAuth } from '@/lib/auth-context';
import { PLATFORM_ROLE_LABELS, TENANT_TYPE_LABELS, type PlatformRole } from '@/lib/types';

export default function NovoUsuarioPlatformPage() {
  const { accessToken } = usePlatformAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [tenantId, setTenantId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformRole>('NUTRITIONIST');

  const [createdCredentials, setCreatedCredentials] = useState<{
    userClinicId: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);

  const tenantsQuery = useQuery({
    queryKey: ['platform-tenants-options'],
    queryFn: () => listPlatformTenants(accessToken!, { pageSize: 100 }),
    enabled: !!accessToken,
  });
  const tenants = tenantsQuery.data?.data ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (!tenantId || !name.trim() || !email.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPlatformUser(accessToken, {
        tenantId,
        name: name.trim(),
        email: email.trim(),
        role,
      });
      toast.success('Usuário criado com sucesso');
      setCreatedCredentials({
        userClinicId: result.user.id,
        email: result.user.email,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível criar o usuário');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo usuário</h1>
        <p className="text-sm text-muted-foreground">Cria um usuário para um cliente já cadastrado</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do usuário</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Cliente *</Label>
              <Select value={tenantId} onValueChange={(v) => setTenantId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente">
                    {(v: string) => {
                      const tenant = tenants.find((t) => t.id === v);
                      return tenant ? `${tenant.name} (${TENANT_TYPE_LABELS[tenant.type]})` : '';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({TENANT_TYPE_LABELS[t.type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Clientes do tipo &quot;Nutricionista independente&quot; (SOLO) já têm seu único usuário — não é possível
                adicionar outro.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Perfil *</Label>
              <Select value={role} onValueChange={(v) => setRole((v as PlatformRole) ?? 'NUTRITIONIST')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione">{(v: string) => PLATFORM_ROLE_LABELS[v as PlatformRole]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar usuário'}
          </Button>
        </div>
      </form>

      <Dialog open={!!createdCredentials} onOpenChange={() => undefined}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário criado</DialogTitle>
            <DialogDescription>
              Senha provisória — mostrada só desta vez. Repasse ao usuário por um canal seguro e peça para trocar no
              primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">E-mail: </span>
                <span className="font-mono">{createdCredentials.email}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Senha provisória: </span>
                <span className="font-mono">{createdCredentials.temporaryPassword}</span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                if (createdCredentials) router.push(`/platform/usuarios/${createdCredentials.userClinicId}`);
              }}
            >
              Ver usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
