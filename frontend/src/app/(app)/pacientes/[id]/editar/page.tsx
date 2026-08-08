'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PatientForm } from '@/components/patient-form';
import { Skeleton } from '@/components/ui/skeleton';
import { getPatient } from '@/lib/api/patients';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function EditarPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken } = useAuth();

  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatient(accessToken!, id),
    enabled: !!accessToken,
  });

  if (patientQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (patientQuery.isError || !patientQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 p-12 text-center">
        <p className="font-medium">Não foi possível carregar o paciente</p>
        <p className="text-sm text-muted-foreground">
          {patientQuery.error instanceof ApiError ? patientQuery.error.message : 'Tente novamente em instantes.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar paciente</h1>
        <p className="text-sm text-muted-foreground">{patientQuery.data.fullName}</p>
      </div>
      <PatientForm mode="edit" patient={patientQuery.data} />
    </div>
  );
}
