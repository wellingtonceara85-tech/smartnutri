'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, MoreHorizontal, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PatientStatusBadge } from '@/components/patient-status-badge';
import { archivePatient, listPatients } from '@/lib/api/patients';
import { listNutritionists } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { buildWhatsAppLink, maskPhone } from '@/lib/masks';
import { PATIENT_STATUS_LABELS, type PatientStatus } from '@/lib/types';

const PAGE_SIZE = 20;

export default function PacientesPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PatientStatus | 'ALL'>('ALL');
  const [nutritionistId, setNutritionistId] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);

  const canArchive = user?.role === 'ADMIN';
  const canChangeStatus = user?.role === 'ADMIN' || user?.role === 'RECEPTION';

  const patientsQuery = useQuery({
    queryKey: ['patients', { search, status, nutritionistId, page }],
    queryFn: () =>
      listPatients(accessToken!, {
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
        responsibleNutritionistId: nutritionistId === 'ALL' ? undefined : nutritionistId,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!accessToken,
  });

  const nutritionistsQuery = useQuery({
    queryKey: ['nutritionists'],
    queryFn: () => listNutritionists(accessToken!),
    enabled: !!accessToken,
  });

  const totalPages = useMemo(() => {
    if (!patientsQuery.data) return 1;
    return Math.max(1, Math.ceil(patientsQuery.data.total / PAGE_SIZE));
  }, [patientsQuery.data]);

  async function handleArchive() {
    if (!archiveTarget || !accessToken) return;
    try {
      await archivePatient(accessToken, archiveTarget.id);
      toast.success('Paciente arquivado com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível arquivar o paciente');
    } finally {
      setArchiveTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pacientes</h1>
          <p className="text-muted-foreground">Cadastro e acompanhamento dos pacientes da clínica</p>
        </div>
        <Button nativeButton={false} render={<Link href="/pacientes/novo" />}>
          <Plus className="size-4" />
          Novo paciente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Busque por nome, nome social, CPF, telefone ou e-mail</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as PatientStatus | 'ALL');
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Status">
                {(value: string) => (value === 'ALL' ? 'Todos os status' : PATIENT_STATUS_LABELS[value as PatientStatus])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {Object.entries(PATIENT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={nutritionistId}
            onValueChange={(value) => {
              setNutritionistId(value ?? 'ALL');
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Nutricionista">
                {(value: string) =>
                  value === 'ALL' ? 'Todos os nutricionistas' : (nutritionistsQuery.data?.find((n) => n.id === value)?.name ?? '')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os nutricionistas</SelectItem>
              {nutritionistsQuery.data?.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {patientsQuery.isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : patientsQuery.isError ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <p className="font-medium">Não foi possível carregar os pacientes</p>
              <p className="text-sm text-muted-foreground">
                {patientsQuery.error instanceof ApiError ? patientsQuery.error.message : 'Tente novamente em instantes.'}
              </p>
              <Button variant="outline" onClick={() => patientsQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : patientsQuery.data?.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <p className="font-medium">Nenhum paciente encontrado</p>
              <p className="text-sm text-muted-foreground">Ajuste os filtros ou cadastre um novo paciente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Nutricionista</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientsQuery.data?.data.map((patient) => {
                    const whatsapp = patient.whatsappPhone ?? patient.primaryPhone;
                    return (
                      <TableRow key={patient.id}>
                        <TableCell>
                          <Link href={`/pacientes/${patient.id}`} className="font-medium hover:underline">
                            {patient.fullName}
                          </Link>
                          {patient.socialName && <div className="text-xs text-muted-foreground">({patient.socialName})</div>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            {patient.primaryPhone && <span>{maskPhone(patient.primaryPhone)}</span>}
                            {patient.email && <span className="text-muted-foreground">{patient.email}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {patient.responsibleNutritionist ? (
                            patient.responsibleNutritionist.name
                          ) : (
                            <span className="text-muted-foreground">Não atribuído</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <PatientStatusBadge status={patient.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(patient.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted">
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem render={<Link href={`/pacientes/${patient.id}`} />}>Visualizar</DropdownMenuItem>
                              <DropdownMenuItem render={<Link href={`/pacientes/${patient.id}/editar`} />}>Editar</DropdownMenuItem>
                              {whatsapp && (
                                <DropdownMenuItem render={<a href={buildWhatsAppLink(whatsapp)} target="_blank" rel="noreferrer" />}>
                                  <MessageCircle className="size-4" />
                                  Abrir WhatsApp
                                </DropdownMenuItem>
                              )}
                              {canChangeStatus && (
                                <DropdownMenuItem render={<Link href={`/pacientes/${patient.id}/editar`} />}>
                                  Alterar status
                                </DropdownMenuItem>
                              )}
                              {canArchive && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setArchiveTarget({ id: patient.id, name: patient.fullName })}
                                >
                                  Arquivar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {patientsQuery.data && patientsQuery.data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {patientsQuery.data.total} paciente{patientsQuery.data.total === 1 ? '' : 's'} — página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar paciente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar <strong>{archiveTarget?.name}</strong>? O paciente deixará de aparecer nas listagens
              ativas, mas seu histórico será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
