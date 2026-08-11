import { DiscountType, Prisma } from '../../generated/prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

type DecimalInput = string | number | Decimal;

/**
 * Converte a entrada bruta do desconto (R$ ou %) num valor sempre em R$ — o
 * preço-base nunca é alterado, só usado para calcular quanto o percentual
 * representa. Nunca retorna mais que `baseValue` (desconto não gera valor
 * final negativo).
 */
export function computeDiscountAmount(
  baseValue: DecimalInput,
  discountType: DiscountType,
  discountValue: DecimalInput,
): Decimal {
  const base = new Decimal(baseValue);
  const rawDiscount =
    discountType === 'PERCENTAGE'
      ? base.mul(new Decimal(discountValue)).div(100)
      : new Decimal(discountValue);
  return Decimal.min(rawDiscount, base).toDecimalPlaces(2);
}

/** `finalValue = baseValue - desconto(R$) + acréscimo` — nunca abaixo de zero. */
export function computeFinalValue(
  baseValue: DecimalInput,
  discountAmount: DecimalInput,
  surcharge: DecimalInput = 0,
): Decimal {
  const value = new Decimal(baseValue)
    .minus(new Decimal(discountAmount))
    .plus(new Decimal(surcharge));
  return Decimal.max(value, 0).toDecimalPlaces(2);
}

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
