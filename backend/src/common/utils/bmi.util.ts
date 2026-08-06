/** IMC = peso (kg) / altura (m)². Retorna null se faltar peso ou altura. */
export function computeBmi(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (!weightKg || !heightCm) {
    return null;
  }
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 100) / 100;
}

/**
 * Classificação OMS — só se aplica a adultos (>= 18 anos). Para menores,
 * a curva de referência é outra e não deve ser aproximada por essa tabela.
 */
export function classifyBmi(
  bmi: number | null,
  ageYears: number | null,
): string | null {
  if (bmi === null) {
    return null;
  }
  if (ageYears === null || ageYears < 18) {
    return 'Classificação não aplicada (fora da faixa adulta)';
  }
  if (bmi < 18.5) return 'Abaixo do peso';
  if (bmi < 25) return 'Peso adequado';
  if (bmi < 30) return 'Sobrepeso';
  if (bmi < 35) return 'Obesidade grau I';
  if (bmi < 40) return 'Obesidade grau II';
  return 'Obesidade grau III';
}

export function ageInYears(
  birthDate: Date | null,
  referenceDate: Date,
): number | null {
  if (!birthDate) {
    return null;
  }
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}
