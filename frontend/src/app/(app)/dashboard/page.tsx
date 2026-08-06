'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getProfessionalProfile } from '@/lib/api/professional-profile';
import { useAuth } from '@/lib/auth-context';

function timeBasedGreeting(hour: number): string {
  if (hour < 5) return 'Boa noite';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardPage() {
  const { user, accessToken } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['professional-profile'],
    queryFn: () => getProfessionalProfile(accessToken!),
    enabled: !!accessToken,
    staleTime: 60_000,
  });

  const displayName = profileQuery.data?.displayName || user?.name || '';
  const firstName = displayName.split(' ')[0];
  const greeting = timeBasedGreeting(new Date().getHours());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting}, {firstName}
        </h1>
        <p className="text-muted-foreground">Este é o seu painel no SmartNutri</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fundação do sistema pronta</CardTitle>
          <CardDescription>
            Login, autorização por perfil e o esqueleto do painel estão funcionando. Os indicadores (consultas de hoje, valores a
            receber, próximos vencimentos) chegam nas próximas etapas.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Perfil conectado: {user?.role}</CardContent>
      </Card>
    </div>
  );
}
