'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeOwnPassword } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Autosserviço de troca de senha (Missão 0006.4) — sempre exige a senha atual,
 * nunca um fluxo de "esqueci minha senha" (isso continua sendo o reset feito por um ADMIN). */
export function ChangePasswordForm() {
  const { accessToken } = useTenantAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(values: FormOutput) {
    if (!accessToken) return;
    try {
      await changeOwnPassword(accessToken, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Senha alterada com sucesso');
      reset();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível alterar a senha');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alterar minha senha</CardTitle>
        <CardDescription>Você precisa informar a senha atual para definir uma nova.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 sm:max-w-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} />
            {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} />
            {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-fit">
            {isSubmitting ? 'Salvando...' : 'Alterar senha'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
