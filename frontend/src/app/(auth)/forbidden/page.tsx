import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <ShieldAlert className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Acesso não permitido</h1>
      <p className="max-w-sm text-muted-foreground">Seu perfil não tem permissão para acessar esta página.</p>
      <Button nativeButton={false} render={<Link href="/dashboard">Voltar ao painel</Link>} />
    </div>
  );
}
