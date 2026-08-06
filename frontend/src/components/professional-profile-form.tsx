'use client';

import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { ImagePlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  getProfessionalProfile,
  updateProfessionalProfile,
  uploadProfileLogo,
  uploadProfilePhoto,
} from '@/lib/api/professional-profile';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { maskPhone } from '@/lib/masks';
import { PROFESSIONAL_PALETTE_PRESETS, type ProfessionalProfile } from '@/lib/types';

const optionalString = z.string().optional().or(z.literal(''));
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida');

const profileSchema = z.object({
  displayName: z.string().min(2, 'Informe o nome de exibição'),
  professionalName: z.string().min(2, 'Informe o nome profissional'),
  professionalTitle: optionalString,
  crnNumber: optionalString,
  crnState: optionalString,
  specialty: optionalString,
  shortBio: optionalString,
  primaryPhone: optionalString,
  whatsappPhone: optionalString,
  email: optionalString.refine((v) => !v || z.string().email().safeParse(v).success, 'E-mail inválido'),
  instagram: optionalString,
  website: optionalString,
  companyName: optionalString,
  legalName: optionalString,
  documentNumber: optionalString,
  addressLine: optionalString,
  primaryColor: hexColor,
  secondaryColor: hexColor,
});

type ProfileFormSchema = z.infer<typeof profileSchema>;

function toFormValues(profile?: ProfessionalProfile): Partial<ProfileFormSchema> {
  if (!profile) return {};
  return {
    displayName: profile.displayName,
    professionalName: profile.professionalName,
    professionalTitle: profile.professionalTitle ?? '',
    crnNumber: profile.crnNumber ?? '',
    crnState: profile.crnState ?? '',
    specialty: profile.specialty ?? '',
    shortBio: profile.shortBio ?? '',
    primaryPhone: profile.primaryPhone ? maskPhone(profile.primaryPhone) : '',
    whatsappPhone: profile.whatsappPhone ? maskPhone(profile.whatsappPhone) : '',
    email: profile.email ?? '',
    instagram: profile.instagram ?? '',
    website: profile.website ?? '',
    companyName: profile.companyName ?? '',
    legalName: profile.legalName ?? '',
    documentNumber: profile.documentNumber ?? '',
    addressLine: profile.addressLine ?? '',
    primaryColor: profile.primaryColor,
    secondaryColor: profile.secondaryColor,
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function ProfessionalProfileForm() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery({
    queryKey: ['professional-profile'],
    queryFn: () => getProfessionalProfile(accessToken!),
    enabled: !!accessToken,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormSchema>({
    resolver: zodResolver(profileSchema),
    defaultValues: toFormValues(profileQuery.data),
  });

  useEffect(() => {
    if (profileQuery.data) {
      reset(toFormValues(profileQuery.data));
    }
  }, [profileQuery.data, reset]);

  const primaryColor = watch('primaryColor');
  const secondaryColor = watch('secondaryColor');

  function invalidateProfile() {
    return queryClient.invalidateQueries({ queryKey: ['professional-profile'] });
  }

  const photoMutation = useMutation({
    mutationFn: (file: File) => uploadProfilePhoto(accessToken!, file),
    onSuccess: async () => {
      toast.success('Foto atualizada');
      await invalidateProfile();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Não foi possível enviar a foto'),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => uploadProfileLogo(accessToken!, file),
    onSuccess: async () => {
      toast.success('Logo atualizada');
      await invalidateProfile();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Não foi possível enviar a logo'),
  });

  async function onSubmit(values: ProfileFormSchema) {
    if (!accessToken) return;
    try {
      await updateProfessionalProfile(accessToken, {
        ...values,
        crnNumber: values.crnNumber || undefined,
        crnState: values.crnState || undefined,
        email: values.email || undefined,
        website: values.website || undefined,
      });
      toast.success('Perfil profissional atualizado');
      await invalidateProfile();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível salvar o perfil');
    }
  }

  if (profileQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const profile = profileQuery.data;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Foto e logo</CardTitle>
          <CardDescription>
            A foto aparece no cabeçalho e na saudação; a logo é opcional, para quem já tem marca própria.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="size-20">
              <AvatarImage src={profile?.profilePhotoUrl ?? undefined} alt="Foto do profissional" />
              <AvatarFallback className="text-lg">{initials(profile?.displayName ?? '?')}</AvatarFallback>
            </Avatar>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) photoMutation.mutate(file);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={photoMutation.isPending}
              onClick={() => photoInputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              {photoMutation.isPending ? 'Enviando...' : 'Trocar foto'}
            </Button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex size-20 items-center justify-center rounded-md border bg-muted">
              {profile?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
              ) : (
                <span className="text-xs text-muted-foreground">Sem logo</span>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) logoMutation.mutate(file);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logoMutation.isPending}
              onClick={() => logoInputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              {logoMutation.isPending ? 'Enviando...' : 'Trocar logo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identidade profissional</CardTitle>
          <CardDescription>
            Exibida no lugar de um nome fixo de clínica — funciona tanto para quem atende sozinho quanto para
            clínicas com nome próprio.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Nome de exibição *</Label>
            <Input id="displayName" placeholder="Como você quer ser chamado(a) no sistema" {...register('displayName')} />
            {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="professionalName">Nome profissional completo *</Label>
            <Input id="professionalName" {...register('professionalName')} />
            {errors.professionalName && <p className="text-sm text-destructive">{errors.professionalName.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="professionalTitle">Título profissional</Label>
            <Input id="professionalTitle" placeholder="Ex.: Nutricionista Clínica" {...register('professionalTitle')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="specialty">Especialidade</Label>
            <Input id="specialty" placeholder="Ex.: Nutrição esportiva" {...register('specialty')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="crnNumber">CRN</Label>
            <Input id="crnNumber" {...register('crnNumber')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="crnState">UF do CRN</Label>
            <Input id="crnState" maxLength={2} className="uppercase" {...register('crnState')} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="shortBio">Bio curta</Label>
            <Textarea id="shortBio" rows={3} {...register('shortBio')} />
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" placeholder="@seuusuario" {...register('instagram')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="website">Site</Label>
            <Input id="website" placeholder="https://..." {...register('website')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados da clínica/empresa</CardTitle>
          <CardDescription>Totalmente opcional — deixe em branco se você atende sozinho(a), sem nome de clínica.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">Nome da clínica/empresa</Label>
            <Input id="companyName" {...register('companyName')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="legalName">Razão social</Label>
            <Input id="legalName" {...register('legalName')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="documentNumber">CNPJ/CPF</Label>
            <Input id="documentNumber" {...register('documentNumber')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="addressLine">Endereço</Label>
            <Input id="addressLine" {...register('addressLine')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Escolha uma paleta pronta ou ajuste as cores manualmente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {PROFESSIONAL_PALETTE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setValue('primaryColor', preset.primaryColor, { shouldDirty: true });
                  setValue('secondaryColor', preset.secondaryColor, { shouldDirty: true });
                }}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="flex gap-1">
                  <span className="size-4 rounded-full border" style={{ backgroundColor: preset.primaryColor }} />
                  <span className="size-4 rounded-full border" style={{ backgroundColor: preset.secondaryColor }} />
                </span>
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="primaryColor">Cor primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="size-9 shrink-0 rounded border"
                  value={primaryColor || '#3F7658'}
                  onChange={(e) => setValue('primaryColor', e.target.value, { shouldDirty: true })}
                  aria-label="Selecionar cor primária"
                />
                <Input id="primaryColor" {...register('primaryColor')} />
              </div>
              {errors.primaryColor && <p className="text-sm text-destructive">{errors.primaryColor.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="secondaryColor">Cor secundária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="size-9 shrink-0 rounded border"
                  value={secondaryColor || '#8CAF9A'}
                  onChange={(e) => setValue('secondaryColor', e.target.value, { shouldDirty: true })}
                  aria-label="Selecionar cor secundária"
                />
                <Input id="secondaryColor" {...register('secondaryColor')} />
              </div>
              {errors.secondaryColor && <p className="text-sm text-destructive">{errors.secondaryColor.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Salvar perfil'}
        </Button>
      </div>
    </form>
  );
}
