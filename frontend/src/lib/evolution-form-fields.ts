export interface NumericFieldSpec {
  key: string;
  label: string;
  unit: string;
}

export const ANTHROPOMETRY_FIELDS: NumericFieldSpec[] = [
  { key: 'weightKg', label: 'Peso', unit: 'kg' },
  { key: 'heightCm', label: 'Altura', unit: 'cm' },
  { key: 'desiredWeightKg', label: 'Peso desejado', unit: 'kg' },
  { key: 'neckCm', label: 'Pescoço', unit: 'cm' },
  { key: 'shoulderCm', label: 'Ombro', unit: 'cm' },
  { key: 'chestCm', label: 'Tórax', unit: 'cm' },
  { key: 'waistCm', label: 'Cintura', unit: 'cm' },
  { key: 'abdomenCm', label: 'Abdômen', unit: 'cm' },
  { key: 'hipCm', label: 'Quadril', unit: 'cm' },
  { key: 'gluteCm', label: 'Glúteo', unit: 'cm' },
  { key: 'rightArmCm', label: 'Braço direito', unit: 'cm' },
  { key: 'leftArmCm', label: 'Braço esquerdo', unit: 'cm' },
  { key: 'rightForearmCm', label: 'Antebraço direito', unit: 'cm' },
  { key: 'leftForearmCm', label: 'Antebraço esquerdo', unit: 'cm' },
  { key: 'rightThighCm', label: 'Coxa direita', unit: 'cm' },
  { key: 'leftThighCm', label: 'Coxa esquerda', unit: 'cm' },
  { key: 'rightCalfCm', label: 'Panturrilha direita', unit: 'cm' },
  { key: 'leftCalfCm', label: 'Panturrilha esquerda', unit: 'cm' },
];

export const SKINFOLD_FIELDS: NumericFieldSpec[] = [
  { key: 'tricepsSkinfoldMm', label: 'Tríceps', unit: 'mm' },
  { key: 'bicepsSkinfoldMm', label: 'Bíceps', unit: 'mm' },
  { key: 'subscapularSkinfoldMm', label: 'Subescapular', unit: 'mm' },
  { key: 'suprailiacSkinfoldMm', label: 'Suprailíaca', unit: 'mm' },
  { key: 'abdominalSkinfoldMm', label: 'Abdominal', unit: 'mm' },
  { key: 'chestSkinfoldMm', label: 'Peitoral', unit: 'mm' },
  { key: 'midaxillarySkinfoldMm', label: 'Axilar média', unit: 'mm' },
  { key: 'thighSkinfoldMm', label: 'Coxa', unit: 'mm' },
  { key: 'calfSkinfoldMm', label: 'Panturrilha', unit: 'mm' },
];

/** Grupo "Composição corporal" — água, proteína, minerais, massas. Todos distintos, nunca sinônimos entre si. */
export const BIOIMPEDANCE_COMPOSITION_FIELDS: NumericFieldSpec[] = [
  { key: 'bodyWaterLiters', label: 'Água corporal total', unit: 'L' },
  { key: 'bodyWaterPercent', label: 'Água corporal', unit: '%' },
  { key: 'proteinKg', label: 'Proteína', unit: 'kg' },
  { key: 'proteinPercent', label: 'Proteína', unit: '%' },
  { key: 'mineralMassKg', label: 'Minerais', unit: 'kg' },
  { key: 'boneMassKg', label: 'Massa óssea', unit: 'kg' },
  { key: 'fatMassKg', label: 'Massa de gordura', unit: 'kg' },
  { key: 'bodyFatPercent', label: 'Gordura corporal', unit: '%' },
  { key: 'leanMassKg', label: 'Massa magra', unit: 'kg' },
  { key: 'muscleMassKg', label: 'Massa muscular', unit: 'kg' },
  { key: 'skeletalMuscleMassKg', label: 'Massa muscular esquelética', unit: 'kg' },
  { key: 'musclePercent', label: 'Percentual muscular', unit: '%' },
];

/** Grupo "Indicadores" — pontuação, metabolismo, obesidade. Grau de obesidade nunca é o mesmo indicador que %gordura ou IMC. */
export const BIOIMPEDANCE_INDICATOR_FIELDS: NumericFieldSpec[] = [
  { key: 'bodyCompositionScore', label: 'Pontuação corporal', unit: '' },
  { key: 'bodyCompositionScoreMaximum', label: 'Pontuação máxima possível', unit: '' },
  { key: 'basalMetabolicRateKcal', label: 'Taxa metabólica basal', unit: 'kcal' },
  { key: 'visceralFatLevel', label: 'Gordura visceral', unit: 'nível' },
  { key: 'waistHipRatio', label: 'Relação cintura-quadril', unit: '' },
  { key: 'obesityDegreePercent', label: 'Grau de obesidade', unit: '%' },
  { key: 'metabolicAge', label: 'Idade metabólica', unit: 'anos' },
];

/** Grupo "Controle e metas" — fornecidos pelo equipamento ou definidos pela nutricionista; podem ser negativos, positivos ou zero. */
export const BIOIMPEDANCE_CONTROL_FIELDS: NumericFieldSpec[] = [
  { key: 'referenceWeightKg', label: 'Peso de referência', unit: 'kg' },
  { key: 'recommendedWeightChangeKg', label: 'Ajuste de peso sugerido', unit: 'kg' },
  { key: 'recommendedFatChangeKg', label: 'Ajuste de gordura sugerido', unit: 'kg' },
  { key: 'recommendedMuscleChangeKg', label: 'Ajuste muscular sugerido', unit: 'kg' },
];

/** Mantido para compatibilidade com quem precisa da lista completa (ex.: relatório). */
export const BIOIMPEDANCE_FIELDS: NumericFieldSpec[] = [
  ...BIOIMPEDANCE_COMPOSITION_FIELDS,
  ...BIOIMPEDANCE_INDICATOR_FIELDS,
  ...BIOIMPEDANCE_CONTROL_FIELDS,
  { key: 'impedanceOhms', label: 'Impedância (geral)', unit: 'Ω' },
];

export const SEGMENTS: { key: 'RIGHT_ARM' | 'LEFT_ARM' | 'TRUNK' | 'RIGHT_LEG' | 'LEFT_LEG'; label: string }[] = [
  { key: 'RIGHT_ARM', label: 'Braço direito' },
  { key: 'LEFT_ARM', label: 'Braço esquerdo' },
  { key: 'TRUNK', label: 'Tronco' },
  { key: 'RIGHT_LEG', label: 'Perna direita' },
  { key: 'LEFT_LEG', label: 'Perna esquerda' },
];
