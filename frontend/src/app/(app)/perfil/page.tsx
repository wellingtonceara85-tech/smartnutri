import { ProfessionalProfileForm } from '@/components/professional-profile-form';

export default function PerfilPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meu perfil profissional</h1>
        <p className="text-muted-foreground">
          Como você aparece no SmartNutri — nome, contato, foto e cores. Nada aqui exige o nome de uma clínica.
        </p>
      </div>
      <ProfessionalProfileForm />
    </div>
  );
}
