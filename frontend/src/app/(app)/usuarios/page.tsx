'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, KeyRound, Plus, Play } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  activateTeamMember,
  createTeamMember,
  deactivateTeamMember,
  getTeamUsage,
  listTeamMembers,
  resetTeamMemberPassword,
  updateTeamMemberRole,
} from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';
import { PLATFORM_ROLE_LABELS, type PlatformRole } from '@/lib/types';

export default function UsuariosPage() {
  const { accessToken } = useTenantAuth();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformRole>('NUTRITIONIST');
  const [submitting, setSubmitting] = useState(false);

  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<{ email: string; password: string } | null>(null);

  const membersQuery = useQuery({
    queryKey: ['team-members'],
    queryFn: () => listTeamMembers(accessToken!),
    enabled: !!accessToken,
  });

  const usageQuery = useQuery({
    queryKey: ['team-usage'],
    queryFn: () => getTeamUsage(accessToken!),
    enabled: !!accessToken,
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['team-members'] });
    await queryClient.invalidateQueries({ queryKey: ['team-usage'] });
  }

  const usage = usageQuery.data;
  const atLimit = !!usage && usage.usedUsers >= usage.maxUsers;

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !name.trim() || !email.trim()) return;

    setSubmitting(true);
    try {
      const result = await createTeamMember(accessToken, { name: name.trim(), email: email.trim(), role });
      toast.success('Usuário adicionado à equipe');
      setAddOpen(false);
      setName('');
      setEmail('');
      setRole('NUTRITIONIST');
      await invalidate();
      if (result.temporaryPassword) {
        setRevealedPassword({ email: result.user.email, password: result.temporaryPassword });
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível adicionar o usuário');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: PlatformRole) {
    if (!accessToken) return;
    setBusyId(userId);
    try {
      await updateTeamMemberRole(accessToken, userId, newRole);
      toast.success('Perfil atualizado');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível alterar o perfil');
    } finally {
      setBusyId(null);
    }
  }

  async function handleActivate(userId: string) {
    if (!accessToken) return;
    setBusyId(userId);
    try {
      await activateTeamMember(accessToken, userId);
      toast.success('Acesso reativado');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível reativar o acesso');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSuspend() {
    if (!accessToken || !suspendTarget) return;
    setBusyId(suspendTarget.id);
    try {
      await deactivateTeamMember(accessToken, suspendTarget.id);
      toast.success('Acesso suspenso — nenhum dado foi apagado');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível suspender o acesso');
    } finally {
      setBusyId(null);
      setSuspendTarget(null);
    }
  }

  async function handleResetPassword() {
    if (!accessToken || !resetTarget) return;
    setBusyId(resetTarget.id);
    try {
      const result = await resetTeamMemberPassword(accessToken, resetTarget.id);
      toast.success('Senha redefinida — a senha anterior parou de funcionar');
      setRevealedPassword({ email: resetTarget.name, password: result.temporaryPassword });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível redefinir a senha');
    } finally {
      setBusyId(null);
      setResetTarget(null);
    }
  }

  const members = membersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipe e Acessos</h1>
          <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao SmartNutri nesta clínica</p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={atLimit}>
          <Plus className="size-4" />
          Adicionar usuário
        </Button>
      </div>

      {usage && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-2xl font-bold tracking-tight">
                {usage.usedUsers} de {usage.maxUsers} usuários utilizados
              </p>
              <p className="text-sm text-muted-foreground">Plano {usage.planDisplayName}</p>
            </div>
            {atLimit && (
              <p className="max-w-sm text-sm text-muted-foreground">
                Seu plano permite até {usage.maxUsers} usuário{usage.maxUsers === 1 ? '' : 's'}. Para adicionar outro
                membro à equipe, será necessário alterar o plano. Fale com o suporte SmartNutri.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipe</CardTitle>
          <CardDescription>Nome, e-mail, perfil, status e último acesso</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {membersQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{member.user.name}</p>
                  <p className="text-muted-foreground">{member.user.email}</p>
                  {member.user.lastLoginAt && (
                    <p className="text-xs text-muted-foreground">Último acesso {formatCalendarDate(member.user.lastLoginAt)}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={member.isActive ? 'default' : 'secondary'}>{member.isActive ? 'Ativo' : 'Suspenso'}</Badge>
                  <Select
                    value={member.role}
                    onValueChange={(v) => handleRoleChange(member.userId, (v as PlatformRole) ?? member.role)}
                  >
                    <SelectTrigger className="w-44" disabled={busyId === member.userId}>
                      <SelectValue>{(v: string) => PLATFORM_ROLE_LABELS[v as PlatformRole]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLATFORM_ROLE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === member.userId}
                    onClick={() => setResetTarget({ id: member.userId, name: member.user.email })}
                  >
                    <KeyRound className="size-4" />
                    Redefinir senha
                  </Button>
                  {member.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === member.userId}
                      onClick={() => setSuspendTarget({ id: member.userId, name: member.user.name })}
                    >
                      <Ban className="size-4" />
                      Suspender
                    </Button>
                  ) : (
                    <Button size="sm" disabled={busyId === member.userId} onClick={() => handleActivate(member.userId)}>
                      <Play className="size-4" />
                      Reativar
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <form onSubmit={handleAddMember} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Adicionar usuário</DialogTitle>
              <DialogDescription>
                {usage && `${usage.usedUsers} de ${usage.maxUsers} usuários utilizados no plano ${usage.planDisplayName}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-name">Nome *</Label>
              <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-email">E-mail *</Label>
              <Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Perfil *</Label>
              <Select value={role} onValueChange={(v) => setRole((v as PlatformRole) ?? 'NUTRITIONIST')}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => PLATFORM_ROLE_LABELS[v as PlatformRole]}</SelectValue>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender acesso</AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.name} deixa de conseguir entrar imediatamente, mas continua vinculado à equipe e nenhum
              dado é apagado. Você pode reativar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend}>Suspender</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha</AlertDialogTitle>
            <AlertDialogDescription>
              Uma nova senha provisória será gerada para {resetTarget?.name} e a senha atual deixará de funcionar
              imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>Redefinir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!revealedPassword} onOpenChange={() => setRevealedPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha provisória</DialogTitle>
            <DialogDescription>
              Mostrada só desta vez. Repasse por um canal seguro e peça para trocar no primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          {revealedPassword && (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">E-mail: </span>
                <span className="font-mono">{revealedPassword.email}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Senha: </span>
                <span className="font-mono">{revealedPassword.password}</span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRevealedPassword(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
