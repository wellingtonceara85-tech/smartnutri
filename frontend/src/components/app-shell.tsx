'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Repeat,
  Settings,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getProfessionalProfile } from '@/lib/api/professional-profile';
import { useAuth, type UserRole } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/ciclos', label: 'Ciclos', icon: Repeat },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/relatorios', label: 'Relatórios', icon: ClipboardList },
  { href: '/planos', label: 'Planos', icon: ClipboardList },
  { href: '/usuarios', label: 'Usuários', icon: UsersRound, roles: ['ADMIN'] },
  { href: '/perfil', label: 'Meu perfil', icon: UserCircle, roles: ['ADMIN', 'NUTRITIONIST'] },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, roles: ['ADMIN'] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador(a)',
  NUTRITIONIST: 'Nutricionista',
  RECEPTION: 'Recepção',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, accessToken, status, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ['professional-profile'],
    queryFn: () => getProfessionalProfile(accessToken!),
    enabled: status === 'authenticated' && !!accessToken,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));
  const displayName = profileQuery.data?.displayName || user.name;

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="flex flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <span className="truncate font-semibold text-primary">SmartNutri</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
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
                <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
                <Avatar className="size-8">
                  <AvatarImage src={profileQuery.data?.profilePhotoUrl ?? undefined} alt={displayName} />
                  <AvatarFallback>{initials(displayName)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{displayName}</span>
                      <span className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[user.role]}</span>
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

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-12 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">Em construção — chega nas próximas etapas.</p>
    </div>
  );
}
