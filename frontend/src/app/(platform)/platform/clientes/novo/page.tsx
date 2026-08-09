'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { createPlatformTenant } from '@/lib/api/platform';
import { ApiError } from '@/lib/api-client';
import { usePlatformAuth } from '@/lib/auth-context';
import type { TenantType } from '@/lib/types';

const TYPE_OPTIONS: { value: TenantType; label: string; description: string }[] = [
  { value: 'SOLO', label: 'Nutricionista independente', description: 'Um único usuário administra e atende sozinho.' },
  { value: 'CLINIC', label: 'Clínica', description: 'Equipe com múltiplos profissionais (ADMIN, nutricionistas, recepção).' },
];

export default function NovoClientePage() {
  const { accessToken } = usePlatformAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<TenantType>('SOLO');
  const [name, setName] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [startAsTrial, setStartAsTrial] = useState(false);

  const [createdCredentials, setCreatedCredentials] = useState<{
    tenantId: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (!name.trim() || !responsibleName.trim() || !email.trim() || !phone.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPlatformTenant(accessToken, {
        type,
        name: name.trim(),
        responsibleName: responsibleName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        planCode: planCode || undefined,
        startAsTrial,
      });
      toast.success('Cliente criado com sucesso');
      setCreatedCredentials({
        tenantId: result.tenant.id,
        email: result.owner.email,
        temporaryPassword: result.owner.temporaryPassword,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível criar o cliente');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo cliente</h1>
        <p className="text-sm text-muted-foreground">
          Cria o cliente e o usuário proprietário (ADMIN) de forma transacional
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipo de cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={
                  'flex flex-col gap-1 rounded-lg border p-4 text-left text-sm transition-colors ' +
                  (type === opt.value ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/40')
                }
              >
                <span className="font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.description}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="name">{type === 'SOLO' ? 'Nome profissional *' : 'Nome da clínica *'}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="responsibleName">Nome do responsável *</Label>
              <Input
                id="responsibleName"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Quem vai ser o usuário proprietário"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Telefone *</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="planCode">Plano inicial</Label>
              <Input id="planCode" value={planCode} onChange={(e) => setPlanCode(e.target.value)} placeholder="Ex.: trial, starter" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Situação inicial</Label>
              <Select value={startAsTrial ? 'trial' : 'active'} onValueChange={(v) => setStartAsTrial(v === 'trial')}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => (v === 'trial' ? 'Em teste (trial)' : 'Ativo')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="trial">Em teste (trial)</SelectItem>
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
            {submitting ? 'Criando...' : 'Criar cliente'}
          </Button>
        </div>
      </form>

      <Dialog open={!!createdCredentials} onOpenChange={() => undefined}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cliente criado</DialogTitle>
            <DialogDescription>
              Senha provisória — mostrada só desta vez. Repasse ao cliente por um canal seguro e peça para trocar no
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
                if (createdCredentials) router.push(`/platform/clientes/${createdCredentials.tenantId}`);
              }}
            >
              Ver cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
