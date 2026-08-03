'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá, {user?.name.split(' ')[0]}</h1>
        <p className="text-muted-foreground">Painel de {user?.tenantName}</p>
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
