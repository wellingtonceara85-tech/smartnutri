import { Prisma } from '../../generated/prisma/client';

/**
 * Catálogos mínimos que todo tenant novo precisa para usar Agenda/Contratação
 * sem configuração manual prévia (Missão 0005.9). `AppointmentType` e
 * `PaymentMethod` só têm endpoint de listagem hoje — sem essa provisão, um
 * tenant novo nasce com os dois vazios e sem nenhuma forma de populá-los.
 * Fonte única: os mesmos nomes usados em `prisma/seed.ts` para o tenant demo.
 */
export const DEFAULT_APPOINTMENT_TYPES: {
  name: string;
  defaultDurationMinutes: number;
}[] = [
  { name: 'Primeira consulta', defaultDurationMinutes: 60 },
  { name: 'Retorno', defaultDurationMinutes: 40 },
  { name: 'Avaliação', defaultDurationMinutes: 60 },
  { name: 'Acompanhamento', defaultDurationMinutes: 30 },
  { name: 'Encaixe', defaultDurationMinutes: 20 },
  { name: 'Outro', defaultDurationMinutes: 30 },
];

export const DEFAULT_PAYMENT_METHOD_NAMES: string[] = [
  'PIX',
  'Dinheiro',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Transferência',
  'Boleto',
  'Outro',
];

type CatalogProvisioningClient = Pick<
  Prisma.TransactionClient,
  'appointmentType' | 'paymentMethod'
>;

/**
 * Idempotente: `skipDuplicates` + `@@unique([tenantId, name])` garantem que
 * chamar de novo para o mesmo tenant (ex.: reexecução de um provisionamento)
 * nunca duplica linhas. Reutilizada tanto na criação de tenant (SOLO e
 * CLINIC, mesmo caminho) quanto em provisionamento avulso para um tenant já
 * existente.
 */
export async function provisionDefaultCatalogs(
  client: CatalogProvisioningClient,
  tenantId: string,
): Promise<void> {
  await client.appointmentType.createMany({
    data: DEFAULT_APPOINTMENT_TYPES.map((type) => ({ tenantId, ...type })),
    skipDuplicates: true,
  });
  await client.paymentMethod.createMany({
    data: DEFAULT_PAYMENT_METHOD_NAMES.map((name) => ({ tenantId, name })),
    skipDuplicates: true,
  });
}
