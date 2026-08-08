'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createMealPlan, updateMealPlan } from '@/lib/api/meal-plans';
import { listNutritionists } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type {
  MealFormValues,
  MealItemFormValues,
  MealItemSubstitutionFormValues,
  MealPlan,
  MealPlanFormValues,
} from '@/lib/types';

const OBJECTIVE_OPTIONS = [
  'Emagrecimento',
  'Ganho de massa muscular',
  'Reeducação alimentar',
  'Manutenção de peso',
  'Controle de condição de saúde',
  'Performance esportiva',
  'Outro',
];

type SubForm = MealItemSubstitutionFormValues & { key: string };
type ItemForm = Omit<MealItemFormValues, 'substitutions'> & { key: string; substitutions: SubForm[] };
type MealForm = Omit<MealFormValues, 'items'> & { key: string; items: ItemForm[] };

let uidCounter = 0;
function newKey(): string {
  uidCounter += 1;
  return `k${uidCounter}-${Date.now()}`;
}

function emptySubstitution(): SubForm {
  return { key: newKey(), description: '' };
}
function emptyItem(): ItemForm {
  return { key: newKey(), description: '', substitutions: [] };
}
function emptyMeal(): MealForm {
  return { key: newKey(), name: '', items: [] };
}

function toMealForms(meals?: MealPlan['meals']): MealForm[] {
  if (!meals?.length) return [];
  return meals.map((m) => ({
    key: newKey(),
    name: m.name,
    scheduledTime: m.scheduledTime ?? undefined,
    timeDescription: m.timeDescription ?? undefined,
    instructions: m.instructions ?? undefined,
    items: m.items.map((it) => ({
      key: newKey(),
      description: it.description,
      quantity: it.quantity ? Number(it.quantity) : undefined,
      unit: it.unit ?? undefined,
      householdMeasure: it.householdMeasure ?? undefined,
      instructions: it.instructions ?? undefined,
      substitutions: it.substitutions.map((s) => ({
        key: newKey(),
        description: s.description,
        quantity: s.quantity ? Number(s.quantity) : undefined,
        unit: s.unit ?? undefined,
        householdMeasure: s.householdMeasure ?? undefined,
        notes: s.notes ?? undefined,
      })),
    })),
  }));
}

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

interface MealPlanEditorProps {
  mode: 'create' | 'edit';
  patientId: string;
  mealPlan?: MealPlan;
  appointmentId?: string;
}

export function MealPlanEditor({ mode, patientId, mealPlan, appointmentId }: MealPlanEditorProps) {
  const { accessToken, user } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const isKnownObjective = mealPlan?.objective ? OBJECTIVE_OPTIONS.includes(mealPlan.objective) : false;

  const [title, setTitle] = useState(mealPlan?.title ?? '');
  const [objective, setObjective] = useState(mealPlan ? (isKnownObjective ? mealPlan.objective! : 'Outro') : '');
  const [customObjective, setCustomObjective] = useState(mealPlan?.customObjective ?? (mealPlan && !isKnownObjective ? mealPlan.objective ?? '' : ''));
  const [effectiveFrom, setEffectiveFrom] = useState(mealPlan?.effectiveFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [effectiveUntil, setEffectiveUntil] = useState(mealPlan?.effectiveUntil?.slice(0, 10) ?? '');
  const [nutritionistUserId, setNutritionistUserId] = useState(mealPlan?.nutritionistUser.id ?? '');
  const [generalGuidelines, setGeneralGuidelines] = useState(mealPlan?.generalGuidelines ?? '');
  const [dailyWaterGoalMl, setDailyWaterGoalMl] = useState(mealPlan?.dailyWaterGoalMl?.toString() ?? '');
  const [patientVisibleNotes, setPatientVisibleNotes] = useState(mealPlan?.patientVisibleNotes ?? '');
  const [internalNotes, setInternalNotes] = useState(mealPlan?.internalNotes ?? '');
  const [meals, setMeals] = useState<MealForm[]>(() => toMealForms(mealPlan?.meals));

  const nutritionistsQuery = useQuery({
    queryKey: ['nutritionists'],
    queryFn: () => listNutritionists(accessToken!),
    enabled: !!accessToken && user?.role === 'ADMIN',
  });

  function updateMeal(mealKey: string, patch: Partial<MealForm>) {
    setMeals((prev) => prev.map((m) => (m.key === mealKey ? { ...m, ...patch } : m)));
  }
  function addMeal() {
    setMeals((prev) => [...prev, emptyMeal()]);
  }
  function removeMeal(mealKey: string) {
    setMeals((prev) => prev.filter((m) => m.key !== mealKey));
  }
  function moveMeal(index: number, direction: -1 | 1) {
    setMeals((prev) => moveItem(prev, index, direction));
  }

  function updateItem(mealKey: string, itemKey: string, patch: Partial<ItemForm>) {
    setMeals((prev) =>
      prev.map((m) =>
        m.key === mealKey ? { ...m, items: m.items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it)) } : m,
      ),
    );
  }
  function addItem(mealKey: string) {
    setMeals((prev) => prev.map((m) => (m.key === mealKey ? { ...m, items: [...m.items, emptyItem()] } : m)));
  }
  function removeItem(mealKey: string, itemKey: string) {
    setMeals((prev) =>
      prev.map((m) => (m.key === mealKey ? { ...m, items: m.items.filter((it) => it.key !== itemKey) } : m)),
    );
  }
  function moveItemWithinMeal(mealKey: string, index: number, direction: -1 | 1) {
    setMeals((prev) => prev.map((m) => (m.key === mealKey ? { ...m, items: moveItem(m.items, index, direction) } : m)));
  }

  function updateSubstitution(mealKey: string, itemKey: string, subKey: string, patch: Partial<SubForm>) {
    setMeals((prev) =>
      prev.map((m) =>
        m.key === mealKey
          ? {
              ...m,
              items: m.items.map((it) =>
                it.key === itemKey
                  ? { ...it, substitutions: it.substitutions.map((s) => (s.key === subKey ? { ...s, ...patch } : s)) }
                  : it,
              ),
            }
          : m,
      ),
    );
  }
  function addSubstitution(mealKey: string, itemKey: string) {
    setMeals((prev) =>
      prev.map((m) =>
        m.key === mealKey
          ? { ...m, items: m.items.map((it) => (it.key === itemKey ? { ...it, substitutions: [...it.substitutions, emptySubstitution()] } : it)) }
          : m,
      ),
    );
  }
  function removeSubstitution(mealKey: string, itemKey: string, subKey: string) {
    setMeals((prev) =>
      prev.map((m) =>
        m.key === mealKey
          ? {
              ...m,
              items: m.items.map((it) =>
                it.key === itemKey ? { ...it, substitutions: it.substitutions.filter((s) => s.key !== subKey) } : it,
              ),
            }
          : m,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (!title.trim()) {
      toast.error('Informe um título para o plano');
      return;
    }

    const payload: MealPlanFormValues = {
      title: title.trim(),
      objective: objective === 'Outro' ? customObjective || undefined : objective || undefined,
      customObjective: objective === 'Outro' ? customObjective || undefined : undefined,
      effectiveFrom,
      effectiveUntil: effectiveUntil || undefined,
      nutritionistUserId: nutritionistUserId || undefined,
      appointmentId: mode === 'create' ? appointmentId : undefined,
      generalGuidelines: generalGuidelines || undefined,
      dailyWaterGoalMl: dailyWaterGoalMl ? Number(dailyWaterGoalMl) : undefined,
      patientVisibleNotes: patientVisibleNotes || undefined,
      internalNotes: internalNotes || undefined,
      meals: meals.map((m, mealIndex) => ({
        name: m.name,
        scheduledTime: m.scheduledTime || undefined,
        timeDescription: m.timeDescription || undefined,
        instructions: m.instructions || undefined,
        displayOrder: mealIndex,
        items: m.items.map((it, itemIndex) => ({
          description: it.description,
          quantity: it.quantity,
          unit: it.unit || undefined,
          householdMeasure: it.householdMeasure || undefined,
          instructions: it.instructions || undefined,
          displayOrder: itemIndex,
          substitutions: it.substitutions.map((s, subIndex) => ({
            description: s.description,
            quantity: s.quantity,
            unit: s.unit || undefined,
            householdMeasure: s.householdMeasure || undefined,
            notes: s.notes || undefined,
            displayOrder: subIndex,
          })),
        })),
      })),
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await createMealPlan(accessToken, patientId, payload);
        toast.success('Plano alimentar criado');
        router.push(`/pacientes/${patientId}/plano-alimentar/${created.id}`);
      } else if (mealPlan) {
        await updateMealPlan(accessToken, mealPlan.id, payload);
        toast.success('Plano alimentar atualizado');
        router.push(`/pacientes/${patientId}/plano-alimentar/${mealPlan.id}`);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível salvar o plano alimentar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do plano</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Plano de emagrecimento — fase 1" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Objetivo</Label>
            <Select value={objective} onValueChange={(v) => setObjective(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione">{(v: string) => v || 'Selecione'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {OBJECTIVE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {objective === 'Outro' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customObjective">Detalhe do objetivo</Label>
              <Input id="customObjective" value={customObjective} onChange={(e) => setCustomObjective(e.target.value)} />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="effectiveFrom">Válido a partir de *</Label>
            <Input id="effectiveFrom" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="effectiveUntil">Válido até</Label>
            <Input id="effectiveUntil" type="date" value={effectiveUntil} onChange={(e) => setEffectiveUntil(e.target.value)} />
          </div>

          {user?.role === 'ADMIN' && (
            <div className="flex flex-col gap-1.5">
              <Label>Nutricionista responsável *</Label>
              <Select value={nutritionistUserId} onValueChange={(v) => setNutritionistUserId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione">
                    {(v: string) => nutritionistsQuery.data?.find((n) => n.id === v)?.name ?? 'Selecione'}
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
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dailyWaterGoalMl">Meta diária de água (ml)</Label>
            <Input
              id="dailyWaterGoalMl"
              type="number"
              min={0}
              value={dailyWaterGoalMl}
              onChange={(e) => setDailyWaterGoalMl(e.target.value)}
              placeholder="Ex.: 2000"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="generalGuidelines">Orientações gerais</Label>
            <Textarea
              id="generalGuidelines"
              value={generalGuidelines}
              onChange={(e) => setGeneralGuidelines(e.target.value)}
              rows={3}
              placeholder="Recomendações gerais que se aplicam ao plano inteiro"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="patientVisibleNotes">Mensagem ao paciente</Label>
            <Textarea
              id="patientVisibleNotes"
              value={patientVisibleNotes}
              onChange={(e) => setPatientVisibleNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="internalNotes">Nota interna — nunca visível ao paciente ou na impressão</Label>
            <Textarea id="internalNotes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Refeições</h2>
        <Button type="button" variant="outline" onClick={addMeal}>
          <Plus className="size-4" />
          Adicionar refeição
        </Button>
      </div>

      {meals.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>Nenhuma refeição adicionada ainda.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {meals.map((meal, mealIndex) => (
          <Card key={meal.key}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <Label>Nome da refeição *</Label>
                  <Input
                    value={meal.name}
                    onChange={(e) => updateMeal(meal.key, { name: e.target.value })}
                    placeholder="Ex.: Café da manhã"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={meal.scheduledTime ?? ''}
                    onChange={(e) => updateMeal(meal.key, { scheduledTime: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Ou descrição do momento</Label>
                  <Input
                    value={meal.timeDescription ?? ''}
                    onChange={(e) => updateMeal(meal.key, { timeDescription: e.target.value })}
                    placeholder="Ex.: Ao acordar"
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="icon" disabled={mealIndex === 0} onClick={() => moveMeal(mealIndex, -1)}>
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={mealIndex === meals.length - 1}
                  onClick={() => moveMeal(mealIndex, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeMeal(meal.key)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Instruções da refeição</Label>
                <Textarea
                  value={meal.instructions ?? ''}
                  onChange={(e) => updateMeal(meal.key, { instructions: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-lg border p-3">
                {meal.items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>}
                {meal.items.map((item, itemIndex) => (
                  <div key={item.key} className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-start gap-2">
                      <div className="grid flex-1 gap-2 sm:grid-cols-4">
                        <div className="sm:col-span-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(meal.key, item.key, { description: e.target.value })}
                            placeholder="Descrição do alimento"
                            required
                          />
                        </div>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.quantity ?? ''}
                          onChange={(e) =>
                            updateItem(meal.key, item.key, { quantity: e.target.value ? Number(e.target.value) : undefined })
                          }
                          placeholder="Qtd."
                        />
                        <Input
                          value={item.unit ?? ''}
                          onChange={(e) => updateItem(meal.key, item.key, { unit: e.target.value })}
                          placeholder="Unidade"
                        />
                        <Input
                          value={item.householdMeasure ?? ''}
                          onChange={(e) => updateItem(meal.key, item.key, { householdMeasure: e.target.value })}
                          placeholder="Medida caseira (ex.: 1 colher de sopa)"
                          className="sm:col-span-2"
                        />
                        <Input
                          value={item.instructions ?? ''}
                          onChange={(e) => updateItem(meal.key, item.key, { instructions: e.target.value })}
                          placeholder="Observação do item"
                          className="sm:col-span-2"
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={itemIndex === 0}
                          onClick={() => moveItemWithinMeal(meal.key, itemIndex, -1)}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={itemIndex === meal.items.length - 1}
                          onClick={() => moveItemWithinMeal(meal.key, itemIndex, 1)}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(meal.key, item.key)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pl-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Substituições — escolha uma opção</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => addSubstitution(meal.key, item.key)}>
                          <Plus className="size-3.5" />
                          Substituição
                        </Button>
                      </div>
                      {item.substitutions.map((sub) => (
                        <div key={sub.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                          <Input
                            value={sub.description}
                            onChange={(e) => updateSubstitution(meal.key, item.key, sub.key, { description: e.target.value })}
                            placeholder="Descrição da opção equivalente"
                            required
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-20"
                            value={sub.quantity ?? ''}
                            onChange={(e) =>
                              updateSubstitution(meal.key, item.key, sub.key, {
                                quantity: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            placeholder="Qtd."
                          />
                          <Input
                            className="w-28"
                            value={sub.unit ?? ''}
                            onChange={(e) => updateSubstitution(meal.key, item.key, sub.key, { unit: e.target.value })}
                            placeholder="Unidade"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSubstitution(meal.key, item.key, sub.key)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => addItem(meal.key)}>
                  <Plus className="size-4" />
                  Adicionar item
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar plano'}
        </Button>
      </div>
    </form>
  );
}
