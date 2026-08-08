import { PatientForm } from '@/components/patient-form';

export default function NovoPacientePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo paciente</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados abaixo para cadastrar um novo paciente</p>
      </div>
      <PatientForm mode="create" />
    </div>
  );
}
