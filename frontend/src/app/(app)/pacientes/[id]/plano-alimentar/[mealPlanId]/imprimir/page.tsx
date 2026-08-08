'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getMealPlan } from '@/lib/api/meal-plans';
import { getPatient } from '@/lib/api/patients';
import { getProfessionalProfile } from '@/lib/api/professional-profile';
import { useAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';

/**
 * Relatório de impressão do plano — nunca inclui internalNotes, auditoria
 * ou qualquer dado administrativo/financeiro, mesmo que o objeto completo
 * do plano os contenha (a API os retorna para a tela de gestão, não aqui).
 */
export default function ImprimirPlanoAlimentarPage({ params }: { params: Promise<{ id: string; mealPlanId: string }> }) {
  const { id, mealPlanId } = use(params);
  const { accessToken } = useAuth();

  const mealPlanQuery = useQuery({
    queryKey: ['meal-plan', mealPlanId],
    queryFn: () => getMealPlan(accessToken!, mealPlanId),
    enabled: !!accessToken,
  });
  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatient(accessToken!, id),
    enabled: !!accessToken,
  });
  const profileQuery = useQuery({
    queryKey: ['professional-profile'],
    queryFn: () => getProfessionalProfile(accessToken!),
    enabled: !!accessToken,
  });

  if (mealPlanQuery.isLoading || patientQuery.isLoading || profileQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!mealPlanQuery.data || !patientQuery.data || !profileQuery.data) {
    return <p className="text-sm text-muted-foreground">Não foi possível carregar o relatório.</p>;
  }

  const plan = mealPlanQuery.data;
  const patient = patientQuery.data;
  const profile = profileQuery.data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 print:max-w-none">
      <div className="flex items-center justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir
        </Button>
      </div>

      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold">{profile.displayName}</h1>
          {profile.professionalTitle && <p className="text-sm text-muted-foreground">{profile.professionalTitle}</p>}
          {profile.crnNumber && (
            <p className="text-sm text-muted-foreground">
              CRN {profile.crnNumber}
              {profile.crnState ? `/${profile.crnState}` : ''}
            </p>
          )}
        </div>
        {profile.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
        )}
      </header>

      <section>
        <h2 className="text-lg font-semibold">Plano alimentar de {patient.fullName}</h2>
        <p className="text-sm text-muted-foreground">
          {plan.objective && `${plan.objective} · `}
          Válido a partir de {formatCalendarDate(plan.effectiveFrom)}
          {plan.effectiveUntil && ` até ${formatCalendarDate(plan.effectiveUntil)}`}
        </p>
      </section>

      {plan.generalGuidelines && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Orientações gerais</h3>
          <p className="text-sm whitespace-pre-wrap">{plan.generalGuidelines}</p>
        </section>
      )}

      {plan.dailyWaterGoalMl && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Meta diária de água</h3>
          <p className="text-sm">{plan.dailyWaterGoalMl} ml</p>
        </section>
      )}

      {plan.meals.map((meal) => (
        <section key={meal.id} className="print:break-inside-avoid">
          <h3 className="mb-1 text-sm font-semibold">
            {meal.name}
            {(meal.scheduledTime || meal.timeDescription) && (
              <span className="font-normal text-muted-foreground"> — {meal.scheduledTime ?? meal.timeDescription}</span>
            )}
          </h3>
          {meal.instructions && <p className="mb-1 text-sm text-muted-foreground">{meal.instructions}</p>}
          <ul className="flex flex-col gap-1.5 text-sm">
            {meal.items.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.description}</span>
                {(item.quantity || item.unit || item.householdMeasure) && (
                  <span className="text-muted-foreground">
                    {' — '}
                    {[item.quantity, item.unit].filter(Boolean).join(' ')}
                    {item.householdMeasure ? ` (${item.householdMeasure})` : ''}
                  </span>
                )}
                {item.instructions && <div className="text-muted-foreground">{item.instructions}</div>}
                {item.substitutions.length > 0 && (
                  <div className="text-muted-foreground">
                    Substituir por: {item.substitutions.map((s) => s.description).join(' ou ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {plan.patientVisibleNotes && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Mensagem ao paciente</h3>
          <p className="text-sm whitespace-pre-wrap">{plan.patientVisibleNotes}</p>
        </section>
      )}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Relatório gerado via SmartNutri em {new Date().toLocaleDateString('pt-BR')}.
      </footer>
    </div>
  );
}
