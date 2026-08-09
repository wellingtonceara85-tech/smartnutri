'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  UsersRound,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePlatformAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/platform', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/platform/clientes', label: 'Clientes', icon: Building2 },
  { href: '/platform/usuarios', label: 'Usuários', icon: UsersRound },
  { href: '/platform/auditoria', label: 'Auditoria', icon: ScrollText },
  { href: '/platform/configuracoes', label: 'Configurações', icon: Settings },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Shell administrativo da plataforma (Missão 0005.5) — deliberadamente
 * separado do AppShell clínico, para não misturar navegação de tenant com
 * navegação de plataforma. Visualmente ainda é o SmartNutri, mas com uma
 * identidade de área administrativa (badge "Administração da plataforma").
 */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = usePlatformAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && user === null) {
      // Sessão autenticada mas não é platform admin — nunca cai aqui por engano.
      router.replace('/dashboard');
    }
  }, [status, user, router]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="flex flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex h-16 flex-col justify-center border-b px-6">
          <span className="truncate text-lg font-semibold tracking-tight text-primary">SmartNutri</span>
          <span className="text-xs text-muted-foreground">Administração da plataforma</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1.5 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
          <span className="font-semibold text-primary md:hidden">SmartNutri</span>
          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none">
                <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
                <Avatar className="size-8">
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">Admin da plataforma</span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex flex-1 flex-col p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
