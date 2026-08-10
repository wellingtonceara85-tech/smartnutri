'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, KeyRound, Play } from 'lucide-react';
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
  activatePlatformUser,
  getPlatformUser,
  resetPlatformUserPassword,
  suspendPlatformUser,
} from '@/lib/api/platform';
import { ApiError } from '@/lib/api-client';
import { usePlatformAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';
import { PLATFORM_ROLE_LABELS, TENANT_STATUS_LABELS, TENANT_TYPE_LABELS } from '@/lib/types';

export default function PlatformUsuarioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken } = usePlatformAuth();
  const queryClient = useQueryClient();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const userQuery = useQuery({
    queryKey: ['platform-user', id],
    queryFn: () => getPlatformUser(accessToken!, id),
    enabled: !!accessToken,
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['platform-user', id] });
    await queryClient.invalidateQueries({ queryKey: ['platform-users'] });
  }

  async function handleActivate() {
    if (!accessToken) return;
    setBusy(true);
    try {
      await activatePlatformUser(accessToken, id);
      toast.success('Usuário reativado');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível reativar o usuário');
    } finally {
      setBusy(false);
    }
  }

  async function handleSuspend() {
    if (!accessToken) return;
    setBusy(true);
    try {
      await suspendPlatformUser(accessToken, id);
      toast.success('Usuário suspenso — nenhum dado foi apagado');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível suspender o usuário');
    } finally {
      setBusy(false);
      setSuspendOpen(false);
    }
  }

  async function handleResetPassword() {
    if (!accessToken) return;
    setBusy(true);
    try {
      const result = await resetPlatformUserPassword(accessToken, id);
      setNewPassword(result.temporaryPassword);
      toast.success('Senha redefinida — a senha anterior parou de funcionar');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível redefinir a senha');
    } finally {
      setBusy(false);
      setResetOpen(false);
    }
  }

  if (userQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 p-12 text-center">
        <p className="font-medium">Não foi possível carregar o usuário</p>
      </div>
    );
  }

  const user = userQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
            <Badge variant={user.isActive ? 'default' : 'secondary'}>{user.isActive ? 'Ativo' : 'Suspenso'}</Badge>
            <Badge variant="outline">{PLATFORM_ROLE_LABELS[user.role]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-sm text-muted-foreground">
            Cliente:{' '}
            <Link href={`/platform/clientes/${user.tenantId}`} className="underline underline-offset-2">
              {user.tenantName}
            </Link>{' '}
            · {TENANT_TYPE_LABELS[user.tenantType]} · {TENANT_STATUS_LABELS[user.tenantStatus]}
          </p>
          <p className="text-xs text-muted-foreground">Cadastrado em {formatCalendarDate(user.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setResetOpen(true)} disabled={busy}>
            <KeyRound className="size-4" />
            Redefinir senha
          </Button>
          {user.isActive ? (
            <Button variant="outline" onClick={() => setSuspendOpen(true)} disabled={busy}>
              <Ban className="size-4" />
              Suspender usuário
            </Button>
          ) : (
            <Button onClick={handleActivate} disabled={busy}>
              <Play className="size-4" />
              Reativar usuário
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados administrativos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Último acesso</p>
            <p className="font-medium">{user.lastLoginAt ? formatCalendarDate(user.lastLoginAt) : 'Nunca acessou'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Perfil</p>
            <p className="font-medium">{PLATFORM_ROLE_LABELS[user.role]}</p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender usuário</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário deixa de conseguir entrar imediatamente, mas continua vinculado ao cliente e nenhum dado é
              apagado. Você pode reativar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend}>Suspender</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha</AlertDialogTitle>
            <AlertDialogDescription>
              Uma nova senha provisória será gerada e a senha atual deixará de funcionar imediatamente. Você verá a
              nova senha uma única vez, na próxima tela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>Redefinir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!newPassword} onOpenChange={() => setNewPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha redefinida</DialogTitle>
            <DialogDescription>
              Senha provisória — mostrada só desta vez. Repasse ao usuário por um canal seguro e peça para trocar no
              primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          {newPassword && (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">E-mail: </span>
                <span className="font-mono">{user.email}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Nova senha: </span>
                <span className="font-mono">{newPassword}</span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setNewPassword(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
