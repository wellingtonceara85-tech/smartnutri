'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createPatient, updatePatient, updatePatientStatus } from '@/lib/api/patients';
import { listNutritionists } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import { BRAZILIAN_STATES } from '@/lib/brazilian-states';
import { isValidCpf } from '@/lib/cpf';
import { maskCep, maskCpf, maskPhone } from '@/lib/masks';
import { GENDER_LABELS, PATIENT_STATUS_LABELS, type PatientDetail } from '@/lib/types';

const optionalString = z.string().optional().or(z.literal(''));

const patientSchema = z.object({
  fullName: z.string().min(2, 'Informe o nome completo'),
  socialName: optionalString,
  cpf: optionalString.refine((v) => !v || isValidCpf(v), 'CPF inválido'),
  birthDate: optionalString,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  occupation: optionalString,
  email: optionalString.refine((v) => !v || z.string().email().safeParse(v).success, 'E-mail inválido'),
  primaryPhone: optionalString,
  secondaryPhone: optionalString,
  whatsappPhone: optionalString,
  zipCode: optionalString,
  street: optionalString,
  number: optionalString,
  complement: optionalString,
  neighborhood: optionalString,
  city: optionalString,
  state: z.string().optional(),
  emergencyContactName: optionalString,
  emergencyContactPhone: optionalString,
  administrativeNotes: optionalString,
  source: optionalString,
  responsibleNutritionistId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED', 'DISCHARGED', 'ARCHIVED']).optional(),
});

type PatientFormSchema = z.infer<typeof patientSchema>;

const NONE_VALUE = 'NONE';

function toFormValues(patient?: PatientDetail): Partial<PatientFormSchema> {
  if (!patient) return { fullName: '' };
  return {
    fullName: patient.fullName,
    socialName: patient.socialName ?? '',
    cpf: patient.cpf ? maskCpf(patient.cpf) : '',
    birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : '',
    gender: patient.gender ?? undefined,
    occupation: patient.occupation ?? '',
    email: patient.email ?? '',
    primaryPhone: patient.primaryPhone ? maskPhone(patient.primaryPhone) : '',
    secondaryPhone: patient.secondaryPhone ? maskPhone(patient.secondaryPhone) : '',
    whatsappPhone: patient.whatsappPhone ? maskPhone(patient.whatsappPhone) : '',
    zipCode: patient.zipCode ? maskCep(patient.zipCode) : '',
    street: patient.street ?? '',
    number: patient.number ?? '',
    complement: patient.complement ?? '',
    neighborhood: patient.neighborhood ?? '',
    city: patient.city ?? '',
    state: patient.state ?? undefined,
    emergencyContactName: patient.emergencyContactName ?? '',
    emergencyContactPhone: patient.emergencyContactPhone ? maskPhone(patient.emergencyContactPhone) : '',
    administrativeNotes: patient.administrativeNotes ?? '',
    source: patient.source ?? '',
    responsibleNutritionistId: patient.responsibleNutritionistId ?? undefined,
    status: patient.status,
  };
}

interface PatientFormProps {
  mode: 'create' | 'edit';
  patient?: PatientDetail;
}

export function PatientForm({ mode, patient }: PatientFormProps) {
  const { accessToken, user } = useTenantAuth();
  const router = useRouter();

  const nutritionistsQuery = useQuery({
    queryKey: ['nutritionists'],
    queryFn: () => listNutritionists(accessToken!),
    enabled: !!accessToken,
  });

  const canChangeStatus = mode === 'edit' && (user?.role === 'ADMIN' || user?.role === 'RECEPTION');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormSchema>({
    resolver: zodResolver(patientSchema),
    defaultValues: toFormValues(patient),
  });

  async function onSubmit(values: PatientFormSchema) {
    if (!accessToken) return;

    const payload = {
      ...values,
      cpf: values.cpf || undefined,
      birthDate: values.birthDate || undefined,
      responsibleNutritionistId: values.responsibleNutritionistId === NONE_VALUE ? undefined : values.responsibleNutritionistId,
    };
    delete (payload as Record<string, unknown>).status;
    // Campos opcionais vazios viram '' pelo react-hook-form, mas o backend
    // rejeita '' em campos com validador de formato (ex.: @IsEmail) mesmo com @IsOptional.
    for (const key of Object.keys(payload) as (keyof typeof payload)[]) {
      if (payload[key] === '') {
        (payload as Record<string, unknown>)[key] = undefined;
      }
    }

    try {
      if (mode === 'create') {
        const created = await createPatient(accessToken, payload);
        toast.success('Paciente cadastrado com sucesso');
        router.push(`/pacientes/${created.id}`);
      } else if (patient) {
        await updatePatient(accessToken, patient.id, payload);
        if (canChangeStatus && values.status && values.status !== patient.status) {
          await updatePatientStatus(accessToken, patient.id, values.status);
        }
        toast.success('Paciente atualizado com sucesso');
        router.push(`/pacientes/${patient.id}`);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível salvar o paciente');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="fullName">Nome completo *</Label>
            <Input id="fullName" {...register('fullName')} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="socialName">Nome social</Label>
            <Input id="socialName" {...register('socialName')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cpf">CPF</Label>
            <Controller
              control={control}
              name="cpf"
              render={({ field }) => (
                <Input id="cpf" value={field.value ?? ''} onChange={(e) => field.onChange(maskCpf(e.target.value))} />
              )}
            />
            {errors.cpf && <p className="text-sm text-destructive">{errors.cpf.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input id="birthDate" type="date" {...register('birthDate')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Sexo</Label>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">{(value: string) => GENDER_LABELS[value as keyof typeof GENDER_LABELS]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="occupation">Profissão</Label>
            <Input id="occupation" {...register('occupation')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contato</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="primaryPhone">Telefone</Label>
            <Controller
              control={control}
              name="primaryPhone"
              render={({ field }) => (
                <Input id="primaryPhone" value={field.value ?? ''} onChange={(e) => field.onChange(maskPhone(e.target.value))} />
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="secondaryPhone">Telefone secundário</Label>
            <Controller
              control={control}
              name="secondaryPhone"
              render={({ field }) => (
                <Input id="secondaryPhone" value={field.value ?? ''} onChange={(e) => field.onChange(maskPhone(e.target.value))} />
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="whatsappPhone">WhatsApp</Label>
            <Controller
              control={control}
              name="whatsappPhone"
              render={({ field }) => (
                <Input id="whatsappPhone" value={field.value ?? ''} onChange={(e) => field.onChange(maskPhone(e.target.value))} />
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="zipCode">CEP</Label>
            <Controller
              control={control}
              name="zipCode"
              render={({ field }) => (
                <Input id="zipCode" value={field.value ?? ''} onChange={(e) => field.onChange(maskCep(e.target.value))} />
              )}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="street">Logradouro</Label>
            <Input id="street" {...register('street')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="number">Número</Label>
            <Input id="number" {...register('number')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input id="complement" {...register('complement')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input id="neighborhood" {...register('neighborhood')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" {...register('city')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Estado</Label>
            <Controller
              control={control}
              name="state"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Responsável e origem</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Nutricionista responsável</Label>
            <Controller
              control={control}
              name="responsibleNutritionistId"
              render={({ field }) => (
                <Select value={field.value ?? NONE_VALUE} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">
                      {(value: string) =>
                        value === NONE_VALUE ? 'Não atribuído' : (nutritionistsQuery.data?.find((n) => n.id === value)?.name ?? '')
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Não atribuído</SelectItem>
                    {nutritionistsQuery.data?.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="source">Origem do paciente</Label>
            <Input id="source" placeholder="Ex.: Instagram, indicação..." {...register('source')} />
          </div>
          {canChangeStatus && (
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione">
                        {(value: string) => PATIENT_STATUS_LABELS[value as keyof typeof PATIENT_STATUS_LABELS]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PATIENT_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergência e observações</CardTitle>
          <CardDescription>Informações administrativas — visíveis para toda a equipe</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="emergencyContactName">Contato de emergência</Label>
            <Input id="emergencyContactName" {...register('emergencyContactName')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="emergencyContactPhone">Telefone de emergência</Label>
            <Controller
              control={control}
              name="emergencyContactPhone"
              render={({ field }) => (
                <Input
                  id="emergencyContactPhone"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(maskPhone(e.target.value))}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="administrativeNotes">Observações administrativas</Label>
            <Textarea id="administrativeNotes" rows={4} {...register('administrativeNotes')} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Salvar paciente'}
        </Button>
      </div>
    </form>
  );
}
