'use client';

import Link from 'next/link';
import { ClipboardList, UserCircle, UsersRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantAuth } from '@/lib/auth-context';

interface SettingsShortcut {
  href: string;
  title: string;
  description: string;
  icon: typeof UserCircle;
  adminOnly?: boolean;
}

const SHORTCUTS: SettingsShortcut[] = [
  {
    href: '/perfil',
    title: 'Meu perfil profissional',
    description: 'Nome, contato, foto e cores usadas no SmartNutri.',
    icon: UserCircle,
  },
  {
    href: '/planos',
    title: 'Planos de acompanhamento',
    description: 'Catálogo de pacotes (preço, duração, consultas previstas) usado na contratação.',
    icon: ClipboardList,
  },
  {
    href: '/usuarios',
    title: 'Usuários e equipe',
    description: 'Convide, edite papéis e gerencie o acesso da equipe da clínica.',
    icon: UsersRound,
    adminOnly: true,
  },
];

/**
 * Central de configurações (Missão 0006.2): só organiza atalhos para telas
 * que já existem — nenhuma regra nova, nenhuma tela duplicada. Uma central
 * mais completa (dados da clínica, notificações etc.) fica para uma missão
 * própria de Configurações.
 */
export default function ConfiguracoesPage() {
  const { user } = useTenantAuth();

  const visible = SHORTCUTS.filter((s) => !s.adminOnly || user?.role === 'ADMIN');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Acesso rápido às configurações e catálogos do SmartNutri</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <Card key={shortcut.href}>
              <CardHeader>
                <Icon className="size-6 text-primary" />
                <CardTitle className="text-base">{shortcut.title}</CardTitle>
                <CardDescription>{shortcut.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={shortcut.href} />}>
                  Abrir
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <Wallet className="size-6 text-primary" />
          <CardTitle className="text-base">Formas de pagamento e tipos de consulta</CardTitle>
          <CardDescription>
            Já vêm pré-cadastradas automaticamente para todo novo cliente (PIX, dinheiro, cartão, transferência,
            boleto, e os tipos de consulta mais comuns). Uma tela para editar esse catálogo fica para uma próxima
            missão.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
