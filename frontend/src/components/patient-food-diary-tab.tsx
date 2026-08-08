'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  archiveFoodDiaryEntry,
  createFoodDiaryEntry,
  listFoodDiaryEntries,
  removeFoodDiaryPhoto,
  reviewFoodDiaryEntry,
  uploadFoodDiaryPhoto,
} from '@/lib/api/food-diary';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';
import { FOOD_DIARY_STATUS_LABELS, type FoodDiaryEntry, type FoodDiaryStatus } from '@/lib/types';

const STATUS_VARIANT: Record<FoodDiaryStatus, 'default' | 'secondary' | 'outline'> = {
  PENDING_REVIEW: 'outline',
  REVIEWED: 'default',
  NO_REVIEW_NEEDED: 'secondary',
};

function EntryPhotos({ entry, onChanged }: { entry: FoodDiaryEntry; onChanged: () => void }) {
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setUploading(true);
    try {
      await uploadFoodDiaryPhoto(accessToken, entry.id, file);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível enviar a foto');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemove(photoId: string) {
    if (!accessToken) return;
    try {
      await removeFoodDiaryPhoto(accessToken, entry.id, photoId);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível remover a foto');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry.photos.map((photo) => (
        <div key={photo.id} className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="Foto da refeição" className="size-16 rounded-md border object-cover" />
          <button
            type="button"
            onClick={() => handleRemove(photo.id)}
            className="absolute -top-1.5 -right-1.5 hidden size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
        <Camera className="size-3.5" />
        {uploading ? 'Enviando...' : 'Adicionar foto'}
      </Button>
    </div>
  );
}

export function PatientFoodDiaryTab({ patientId }: { patientId: string }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [newOpen, setNewOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryTime, setEntryTime] = useState('');
  const [mealName, setMealName] = useState('');
  const [comment, setComment] = useState('');
  const [statusFilter, setStatusFilter] = useState<FoodDiaryStatus | 'ALL'>('ALL');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const entriesQuery = useQuery({
    queryKey: ['food-diary', patientId, statusFilter],
    queryFn: () => listFoodDiaryEntries(accessToken!, patientId, statusFilter === 'ALL' ? undefined : { status: statusFilter }),
    enabled: !!accessToken,
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['food-diary', patientId] });
  }

  async function handleCreate() {
    if (!accessToken || !mealName.trim()) {
      toast.error('Informe o nome da refeição');
      return;
    }
    try {
      await createFoodDiaryEntry(accessToken, patientId, {
        entryDate,
        entryTime: entryTime || undefined,
        mealName: mealName.trim(),
        comment: comment || undefined,
      });
      toast.success('Registro adicionado ao diário alimentar');
      setNewOpen(false);
      setMealName('');
      setEntryTime('');
      setComment('');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível registrar a refeição');
    }
  }

  async function handleReview(entryId: string, status: 'REVIEWED' | 'NO_REVIEW_NEEDED') {
    if (!accessToken) return;
    try {
      await reviewFoodDiaryEntry(accessToken, entryId, { status, nutritionistFeedback: feedback || undefined });
      toast.success('Avaliação registrada');
      setReviewingId(null);
      setFeedback('');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível registrar a avaliação');
    }
  }

  async function handleArchive(entryId: string) {
    if (!accessToken) return;
    try {
      await archiveFoodDiaryEntry(accessToken, entryId);
      toast.success('Registro removido');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível remover o registro');
    }
  }

  if (entriesQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const entries = entriesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Diário alimentar</h2>
          <p className="text-sm text-muted-foreground">O que o paciente realmente consumiu — registrado pela equipe</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FoodDiaryStatus | 'ALL')}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Status">
                {(v: string) => (v === 'ALL' ? 'Todos os status' : FOOD_DIARY_STATUS_LABELS[v as FoodDiaryStatus])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {Object.entries(FOOD_DIARY_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            Registrar refeição
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>Nenhum registro no diário alimentar ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {entry.mealName}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {formatCalendarDate(entry.entryDate)}
                        {entry.entryTime && ` às ${entry.entryTime}`}
                      </span>
                    </p>
                    {entry.mealPlan && (
                      <p className="text-xs text-muted-foreground">
                        Vinculado ao plano: {entry.mealPlan.title} (v{entry.mealPlan.version})
                        {entry.meal ? ` — ${entry.meal.name}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[entry.status]}>{FOOD_DIARY_STATUS_LABELS[entry.status]}</Badge>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleArchive(entry.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {entry.comment && <p className="text-sm">{entry.comment}</p>}

                <EntryPhotos entry={entry} onChanged={invalidate} />

                {entry.nutritionistFeedback && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      Avaliação de {entry.reviewedByUser?.name}
                    </p>
                    <p>{entry.nutritionistFeedback}</p>
                  </div>
                )}

                {entry.status === 'PENDING_REVIEW' && (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    {reviewingId === entry.id ? (
                      <>
                        <Textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Feedback para o paciente (opcional)"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleReview(entry.id, 'REVIEWED')}>
                            <CheckCircle2 className="size-4" />
                            Salvar avaliação
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReview(entry.id, 'NO_REVIEW_NEEDED')}>
                            Sem necessidade de avaliação
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReviewingId(null);
                              setFeedback('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" className="w-fit" onClick={() => setReviewingId(entry.id)}>
                        Avaliar
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar refeição consumida</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="entryDate">Data *</Label>
                <Input id="entryDate" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="entryTime">Horário</Label>
                <Input id="entryTime" type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mealName">Refeição *</Label>
              <Input id="mealName" value={mealName} onChange={(e) => setMealName(e.target.value)} placeholder="Ex.: Almoço" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comment">Comentário</Label>
              <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
