import { Prisma } from '../../generated/prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

type DecimalInput = string | number | Decimal;

/**
 * Divide um valor em N parcelas iguais (em centavos), absorvendo o resto do
 * arredondamento na última parcela — nunca perde nem cria centavos.
 */
export function splitIntoInstallments(
  total: DecimalInput,
  installmentCount: number,
): Decimal[] {
  if (installmentCount <= 0) {
    throw new Error('installmentCount deve ser maior que zero');
  }

  const totalCents = new Decimal(total).mul(100).toDecimalPlaces(0).toNumber();
  const baseCents = Math.floor(totalCents / installmentCount);
  const remainderCents = totalCents - baseCents * installmentCount;

  return Array.from({ length: installmentCount }, (_, index) => {
    const cents =
      index === installmentCount - 1 ? baseCents + remainderCents : baseCents;
    return new Decimal(cents).div(100);
  });
}
