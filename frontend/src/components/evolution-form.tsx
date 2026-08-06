'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Controller, useFieldArray, useForm, type Path, type UseFormRegister } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { createEvolution, updateEvolution } from '@/lib/api/evolutions';
import { listNutritionists } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  ANTHROPOMETRY_FIELDS,
  BIOIMPEDANCE_COMPOSITION_FIELDS,
  BIOIMPEDANCE_CONTROL_FIELDS,
  BIOIMPEDANCE_FIELDS,
  BIOIMPEDANCE_INDICATOR_FIELDS,
  SEGMENTS,
  SKINFOLD_FIELDS,
  type NumericFieldSpec,
} from '@/lib/evolution-form-fields';
import type { EvolutionFormValues, PatientEvolution } from '@/lib/types';

const REFERENCE_FIELD_OPTIONS = [...ANTHROPOMETRY_FIELDS, ...BIOIMPEDANCE_FIELDS];

type ImpedanceRow = {
  frequencyValue: string;
  frequencyUnit: string;
  rightArmOhms: string;
  leftArmOhms: string;
  trunkOhms: string;
  rightLegOhms: string;
  leftLegOhms: string;
  impedanceUnit: string;
};

type ReferenceRow = {
  fieldKey: string;
  minValue: string;
  maxValue: string;
  unit: string;
  source: string;
  note: string;
};

type FormShape = {
  assessmentDate: string;
  assessmentTime: string;
  title: string;
  objective: string;
  clinicalNotes: string;
  internalNotes: string;
  nutritionistUserId: string;
  anthropometry: Record<string, string>;
  bioimpedance: Record<string, string>;
  bodyType: string;
  deviceManufacturer: string;
  bioimpedanceNotes: string;
  bodyCompositionScoreLabel: string;
  bodyCompositionScoreSource: string;
  segmental: Record<string, string>;
  segmentalFatEstimated: boolean;
  impedanceRows: ImpedanceRow[];
  referenceRows: ReferenceRow[];
};

function segmentalKey(segment: string, metricType: 'FAT_MASS_KG' | 'LEAN_MASS_KG') {
  return `${segment}__${metricType}`;
}

const EMPTY_IMPEDANCE_ROW: ImpedanceRow = {
  frequencyValue: '',
  frequencyUnit: 'kHz',
  rightArmOhms: '',
  leftArmOhms: '',
  trunkOhms: '',
  rightLegOhms: '',
  leftLegOhms: '',
  impedanceUnit: 'ohm',
};

const EMPTY_REFERENCE_ROW: ReferenceRow = {
  fieldKey: '',
  minValue: '',
  maxValue: '',
  unit: '',
  source: '',
  note: '',
};

function toFormValues(evolution?: PatientEvolution): Partial<FormShape> {
  if (!evolution) {
    return {
      assessmentDate: new Date().toISOString().slice(0, 10),
      anthropometry: {},
      bioimpedance: {},
      segmental: {},
      impedanceRows: [],
      referenceRows: [],
    };
  }

  const anthropometry: Record<string, string> = {};
  for (const field of [...ANTHROPOMETRY_FIELDS, ...SKINFOLD_FIELDS]) {
    const value = evolution.anthropometry?.[field.key as keyof typeof evolution.anthropometry];
    if (value !== null && value !== undefined) anthropometry[field.key] = String(value);
  }

  const bioimpedance: Record<string, string> = {};
  for (const field of BIOIMPEDANCE_FIELDS) {
    const value = evolution.bioimpedance?.[field.key as keyof typeof evolution.bioimpedance];
    if (value !== null && value !== undefined) bioimpedance[field.key] = String(value);
  }

  const segmental: Record<string, string> = {};
  let segmentalFatEstimated = false;
  for (const measurement of evolution.segmentalMeasurements) {
    segmental[segmentalKey(measurement.segment, measurement.metricType)] = measurement.valueKg;
    if (measurement.metricType === 'FAT_MASS_KG' && measurement.isEstimated) segmentalFatEstimated = true;
  }

  const impedanceRows: ImpedanceRow[] = (evolution.bioimpedance?.segmentalImpedanceMeasurements ?? []).map((row) => ({
    frequencyValue: row.frequencyValue,
    frequencyUnit: row.frequencyUnit,
    rightArmOhms: row.rightArmOhms ?? '',
    leftArmOhms: row.leftArmOhms ?? '',
    trunkOhms: row.trunkOhms ?? '',
    rightLegOhms: row.rightLegOhms ?? '',
    leftLegOhms: row.leftLegOhms ?? '',
    impedanceUnit: row.impedanceUnit,
  }));

  const referenceRows: ReferenceRow[] = evolution.referenceRanges.map((row) => ({
    fieldKey: row.fieldKey,
    minValue: row.minValue ?? '',
    maxValue: row.maxValue ?? '',
    unit: row.unit ?? '',
    source: row.source ?? '',
    note: row.note ?? '',
  }));

  return {
    assessmentDate: evolution.assessmentDate.slice(0, 10),
    assessmentTime: evolution.assessmentTime ?? '',
    title: evolution.title ?? '',
    objective: evolution.objective ?? '',
    clinicalNotes: evolution.clinicalNotes ?? '',
    internalNotes: evolution.internalNotes ?? '',
    nutritionistUserId: evolution.nutritionistUser.id,
    anthropometry,
    bioimpedance,
    bodyType: evolution.bioimpedance?.bodyType ?? '',
    deviceManufacturer: evolution.bioimpedance?.deviceManufacturer ?? '',
    bioimpedanceNotes: evolution.bioimpedance?.notes ?? '',
    bodyCompositionScoreLabel: evolution.bioimpedance?.bodyCompositionScoreLabel ?? '',
    bodyCompositionScoreSource: evolution.bioimpedance?.bodyCompositionScoreSource ?? '',
    segmental,
    segmentalFatEstimated,
    impedanceRows,
    referenceRows,
  };
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function NumberFieldGrid({
  fields,
  register,
  prefix,
  allowNegative,
}: {
  fields: NumericFieldSpec[];
  register: UseFormRegister<FormShape>;
  prefix: 'anthropometry' | 'bioimpedance';
  allowNegative?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-2">
          <Label htmlFor={`${prefix}.${field.key}`}>
            {field.label}
            {field.unit && <span className="text-muted-foreground"> ({field.unit})</span>}
          </Label>
          <Input
            id={`${prefix}.${field.key}`}
            type="number"
            step="0.01"
            inputMode="decimal"
            {...(allowNegative ? {} : { min: 0 })}
            {...register(`${prefix}.${field.key}` as Path<FormShape>)}
          />
        </div>
      ))}
    </div>
  );
}

interface EvolutionFormProps {
  mode: 'create' | 'edit';
  patientId: string;
  evolution?: PatientEvolution;
}

export function EvolutionForm({ mode, patientId, evolution }: EvolutionFormProps) {
  const { accessToken, user } = useAuth();
  const router = useRouter();

  const nutritionistsQuery = useQuery({
    queryKey: ['nutritionists'],
    queryFn: () => listNutritionists(accessToken!),
    enabled: !!accessToken,
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormShape>({ defaultValues: toFormValues(evolution) });

  const impedanceFieldArray = useFieldArray({ control, name: 'impedanceRows' });
  const referenceFieldArray = useFieldArray({ control, name: 'referenceRows' });

  async function onSubmit(values: FormShape) {
    if (!accessToken) return;

    const anthropometry = Object.fromEntries(
      Object.entries(values.anthropometry ?? {})
        .map(([key, v]) => [key, parseOptionalNumber(v)])
        .filter(([, v]) => v !== undefined),
    );
    const bioimpedance = Object.fromEntries(
      Object.entries(values.bioimpedance ?? {})
        .map(([key, v]) => [key, parseOptionalNumber(v)])
        .filter(([, v]) => v !== undefined),
    );

    const segmentalMeasurements = SEGMENTS.flatMap(({ key: segment }) =>
      (['FAT_MASS_KG', 'LEAN_MASS_KG'] as const)
        .map((metricType) => {
          const raw = values.segmental?.[segmentalKey(segment, metricType)];
          const valueKg = parseOptionalNumber(raw);
          if (valueKg === undefined) return null;
          return {
            segment,
            metricType,
            valueKg,
            isEstimated: metricType === 'FAT_MASS_KG' ? values.segmentalFatEstimated : undefined,
          };
        })
        .filter(
          (
            v,
          ): v is {
            segment: typeof segment;
            metricType: 'FAT_MASS_KG' | 'LEAN_MASS_KG';
            valueKg: number;
            isEstimated: boolean | undefined;
          } => v !== null,
        ),
    );

    const impedanceRows = values.impedanceRows
      .map((row) => {
        const frequencyValue = parseOptionalNumber(row.frequencyValue);
        if (frequencyValue === undefined) return null;
        return {
          frequencyValue,
          frequencyUnit: row.frequencyUnit || undefined,
          rightArmOhms: parseOptionalNumber(row.rightArmOhms),
          leftArmOhms: parseOptionalNumber(row.leftArmOhms),
          trunkOhms: parseOptionalNumber(row.trunkOhms),
          rightLegOhms: parseOptionalNumber(row.rightLegOhms),
          leftLegOhms: parseOptionalNumber(row.leftLegOhms),
          impedanceUnit: row.impedanceUnit || undefined,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const referenceRows = values.referenceRows
      .filter((row) => row.fieldKey)
      .map((row) => ({
        fieldKey: row.fieldKey,
        minValue: parseOptionalNumber(row.minValue),
        maxValue: parseOptionalNumber(row.maxValue),
        unit: row.unit || undefined,
        source: row.source || undefined,
        note: row.note || undefined,
      }));

    const hasBioimpedanceData =
      Object.keys(bioimpedance).length > 0 ||
      !!values.bodyType ||
      !!values.deviceManufacturer ||
      !!values.bioimpedanceNotes ||
      !!values.bodyCompositionScoreLabel ||
      !!values.bodyCompositionScoreSource ||
      impedanceRows.length > 0;

    const payload: EvolutionFormValues = {
      assessmentDate: values.assessmentDate,
      assessmentTime: values.assessmentTime || undefined,
      title: values.title || undefined,
      objective: values.objective || undefined,
      clinicalNotes: values.clinicalNotes || undefined,
      internalNotes: values.internalNotes || undefined,
      nutritionistUserId: values.nutritionistUserId || undefined,
      anthropometry: Object.keys(anthropometry).length > 0 ? anthropometry : undefined,
      bioimpedance: hasBioimpedanceData
        ? {
            ...bioimpedance,
            ...(values.bodyType ? { bodyType: values.bodyType } : {}),
            ...(values.deviceManufacturer ? { deviceManufacturer: values.deviceManufacturer } : {}),
            ...(values.bioimpedanceNotes ? { notes: values.bioimpedanceNotes } : {}),
            ...(values.bodyCompositionScoreLabel ? { bodyCompositionScoreLabel: values.bodyCompositionScoreLabel } : {}),
            ...(values.bodyCompositionScoreSource ? { bodyCompositionScoreSource: values.bodyCompositionScoreSource } : {}),
          }
        : undefined,
      segmentalMeasurements: segmentalMeasurements.length > 0 ? segmentalMeasurements : undefined,
      segmentalImpedanceMeasurements: impedanceRows.length > 0 ? impedanceRows : undefined,
      referenceRanges: referenceRows.length > 0 ? referenceRows : undefined,
    };

    try {
      if (mode === 'create') {
        const created = await createEvolution(accessToken, patientId, payload);
        toast.success('Avaliação registrada');
        router.push(`/pacientes/${patientId}/evolucao/${created.id}`);
      } else if (evolution) {
        await updateEvolution(accessToken, evolution.id, payload);
        toast.success('Avaliação atualizada');
        router.push(`/pacientes/${patientId}/evolucao/${evolution.id}`);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível salvar a avaliação');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados da avaliação</CardTitle>
          <CardDescription>Cada avaliação é um registro independente — nada aqui sobrescreve avaliações anteriores.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="assessmentDate">Data da avaliação *</Label>
            <Input id="assessmentDate" type="date" {...register('assessmentDate', { required: true })} />
            {errors.assessmentDate && <p className="text-sm text-destructive">Informe a data</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="assessmentTime">Horário</Label>
            <Input id="assessmentTime" type="time" {...register('assessmentTime')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" placeholder="Ex.: Avaliação inicial" {...register('title')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Nutricionista responsável</Label>
            <Controller
              control={control}
              name="nutritionistUserId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={user?.role === 'NUTRITIONIST' ? 'Você (padrão)' : 'Selecione'}>
                      {(value: string) => nutritionistsQuery.data?.find((n) => n.id === value)?.name ?? ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
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
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="objective">Objetivo desta fase</Label>
            <Input id="objective" {...register('objective')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue="anthropometry">
            <TabsList className="flex-wrap">
              <TabsTrigger value="anthropometry">Antropometria</TabsTrigger>
              <TabsTrigger value="skinfolds">Dobras cutâneas</TabsTrigger>
              <TabsTrigger value="bioimpedance">Bioimpedância</TabsTrigger>
              <TabsTrigger value="segmental">Segmentar</TabsTrigger>
              <TabsTrigger value="impedance">Impedância (avançado)</TabsTrigger>
              <TabsTrigger value="references">Referências</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="anthropometry" className="pt-4">
              <NumberFieldGrid fields={ANTHROPOMETRY_FIELDS} register={register} prefix="anthropometry" />
            </TabsContent>

            <TabsContent value="skinfolds" className="pt-4">
              <p className="mb-4 text-sm text-muted-foreground">Opcional — preencha só se usar protocolo de dobras cutâneas.</p>
              <NumberFieldGrid fields={SKINFOLD_FIELDS} register={register} prefix="anthropometry" />
            </TabsContent>

            <TabsContent value="bioimpedance" className="pt-4 flex flex-col gap-6">
              <p className="text-sm text-muted-foreground">Opcional — preencha o que o equipamento fornecer.</p>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Composição corporal</h3>
                <NumberFieldGrid fields={BIOIMPEDANCE_COMPOSITION_FIELDS} register={register} prefix="bioimpedance" />
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Indicadores</h3>
                <NumberFieldGrid fields={BIOIMPEDANCE_INDICATOR_FIELDS} register={register} prefix="bioimpedance" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bodyCompositionScoreLabel">Nome da pontuação</Label>
                    <Input
                      id="bodyCompositionScoreLabel"
                      placeholder="Ex.: Pontuação da composição corporal"
                      {...register('bodyCompositionScoreLabel')}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bodyCompositionScoreSource">Origem da pontuação</Label>
                    <Input
                      id="bodyCompositionScoreSource"
                      placeholder="Ex.: equipamento X"
                      {...register('bodyCompositionScoreSource')}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Controle e metas</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Valores fornecidos pelo equipamento ou pela nutricionista — podem ser negativos, positivos ou zero, sem
                  interpretação automática.
                </p>
                <NumberFieldGrid fields={BIOIMPEDANCE_CONTROL_FIELDS} register={register} prefix="bioimpedance" allowNegative />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bodyType">Tipo corporal</Label>
                  <Input id="bodyType" {...register('bodyType')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="deviceManufacturer">Equipamento</Label>
                  <Input id="deviceManufacturer" placeholder="Ex.: nome do equipamento" {...register('deviceManufacturer')} />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="bioimpedanceNotes">Observações da bioimpedância</Label>
                  <Textarea id="bioimpedanceNotes" rows={2} {...register('bioimpedanceNotes')} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="segmental" className="pt-4">
              <p className="mb-2 text-sm text-muted-foreground">
                Massa gorda e massa magra por segmento — só se o equipamento fizer análise segmentar.
              </p>
              <label className="mb-4 flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" {...register('segmentalFatEstimated')} />
                Gordura segmentar é estimada pelo equipamento
              </label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Segmento</th>
                      <th className="py-2 pr-4">Massa gorda (kg)</th>
                      <th className="py-2">Massa magra (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SEGMENTS.map((segment) => (
                      <tr key={segment.key} className="border-t">
                        <td className="py-2 pr-4 font-medium">{segment.label}</td>
                        <td className="py-2 pr-4">
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            className="max-w-32"
                            {...register(`segmental.${segmentalKey(segment.key, 'FAT_MASS_KG')}` as Path<FormShape>)}
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            className="max-w-32"
                            {...register(`segmental.${segmentalKey(segment.key, 'LEAN_MASS_KG')}` as Path<FormShape>)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="impedance" className="pt-4 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Seção avançada e opcional — impedância por frequência (ex.: 20 kHz, 100 kHz) e segmento. Nunca exigida para
                salvar a avaliação. Adicione uma linha por frequência medida.
              </p>
              {impedanceFieldArray.fields.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma frequência adicionada.</p>
              )}
              <div className="flex flex-col gap-4">
                {impedanceFieldArray.fields.map((row, index) => (
                  <div key={row.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium">Frequência {index + 1}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => impedanceFieldArray.remove(index)}>
                        <Trash2 className="size-4" />
                        Remover
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Frequência</Label>
                        <div className="flex gap-1">
                          <Input type="number" step="0.01" {...register(`impedanceRows.${index}.frequencyValue`)} />
                          <Input className="w-16" {...register(`impedanceRows.${index}.frequencyUnit`)} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Braço direito (Ω)</Label>
                        <Input type="number" step="0.01" {...register(`impedanceRows.${index}.rightArmOhms`)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Braço esquerdo (Ω)</Label>
                        <Input type="number" step="0.01" {...register(`impedanceRows.${index}.leftArmOhms`)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Tronco (Ω)</Label>
                        <Input type="number" step="0.01" {...register(`impedanceRows.${index}.trunkOhms`)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Perna direita (Ω)</Label>
                        <Input type="number" step="0.01" {...register(`impedanceRows.${index}.rightLegOhms`)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Perna esquerda (Ω)</Label>
                        <Input type="number" step="0.01" {...register(`impedanceRows.${index}.leftLegOhms`)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => impedanceFieldArray.append(EMPTY_IMPEDANCE_ROW)}>
                <Plus className="size-4" />
                Adicionar frequência
              </Button>
            </TabsContent>

            <TabsContent value="references" className="pt-4 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Faixas de referência informadas pelo equipamento ou pela nutricionista — o SmartNutri nunca diagnostica a
                partir daqui, só exibe o valor de forma neutra.
              </p>
              {referenceFieldArray.fields.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma referência adicionada.</p>
              )}
              <div className="flex flex-col gap-4">
                {referenceFieldArray.fields.map((row, index) => (
                  <div key={row.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium">Referência {index + 1}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => referenceFieldArray.remove(index)}>
                        <Trash2 className="size-4" />
                        Remover
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="flex flex-col gap-1 sm:col-span-1">
                        <Label className="text-xs">Campo</Label>
                        <Controller
                          control={control}
                          name={`referenceRows.${index}.fieldKey`}
                          render={({ field }) => (
                            <Select value={field.value || undefined} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione">
                                  {(value: string) => REFERENCE_FIELD_OPTIONS.find((f) => f.key === value)?.label ?? value}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {REFERENCE_FIELD_OPTIONS.map((f) => (
                                  <SelectItem key={f.key} value={f.key}>
                                    {f.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Mínimo</Label>
                        <Input type="number" step="0.01" {...register(`referenceRows.${index}.minValue`)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Máximo</Label>
                        <Input type="number" step="0.01" {...register(`referenceRows.${index}.maxValue`)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Unidade</Label>
                        <Input {...register(`referenceRows.${index}.unit`)} />
                      </div>
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <Label className="text-xs">Origem</Label>
                        <Input placeholder="Ex.: equipamento, nutricionista" {...register(`referenceRows.${index}.source`)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => referenceFieldArray.append(EMPTY_REFERENCE_ROW)}>
                <Plus className="size-4" />
                Adicionar referência
              </Button>
            </TabsContent>

            <TabsContent value="notes" className="pt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="clinicalNotes">Nota clínica</Label>
                <p className="text-xs text-muted-foreground">Interna — nunca visível ao paciente.</p>
                <Textarea id="clinicalNotes" rows={4} {...register('clinicalNotes')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="internalNotes">Nota interna da equipe</Label>
                <p className="text-xs text-muted-foreground">Interna — nunca visível ao paciente.</p>
                <Textarea id="internalNotes" rows={3} {...register('internalNotes')} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Salvar avaliação'}
        </Button>
      </div>
    </form>
  );
}
