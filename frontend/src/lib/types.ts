export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'DISCHARGED' | 'ARCHIVED';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  PAUSED: 'Acompanhamento pausado',
  DISCHARGED: 'Alta',
  ARCHIVED: 'Arquivado',
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Masculino',
  FEMALE: 'Feminino',
  OTHER: 'Outro',
};

export interface PatientListItem {
  id: string;
  fullName: string;
  socialName: string | null;
  primaryPhone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  status: PatientStatus;
  createdAt: string;
  responsibleNutritionist: { id: string; name: string } | null;
  currentPlan: null;
  nextAppointment: null;
  openBalance: null;
}

export interface PatientListResponse {
  data: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PatientDetail {
  id: string;
  tenantId: string;
  fullName: string;
  socialName: string | null;
  cpf: string | null;
  birthDate: string | null;
  gender: Gender | null;
  bodySilhouettePreference: 'MALE' | 'FEMALE' | 'NEUTRAL' | 'NOT_INFORMED';
  occupation: string | null;
  email: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  whatsappPhone: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  administrativeNotes: string | null;
  source: string | null;
  responsibleNutritionistId: string | null;
  responsibleNutritionist: { id: string; name: string; email: string } | null;
  status: PatientStatus;
  createdAt: string;
  updatedAt: string;
  treatmentCycles: unknown[];
  appointments: unknown[];
  charges: unknown[];
  patientEvolutions: unknown[];
  documents: unknown[];
  currentPlan: null;
  nextAppointment: null;
  openBalance: null;
  auditLog: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actorUser: { id: string; name: string } | null;
  metadata: unknown;
}

export interface PatientFormValues {
  fullName: string;
  socialName?: string;
  cpf?: string;
  birthDate?: string;
  gender?: Gender;
  occupation?: string;
  email?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  whatsappPhone?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  administrativeNotes?: string;
  source?: string;
  responsibleNutritionistId?: string;
}

export interface Plan {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  durationMonths: number;
  suggestedAppointments: number;
  suggestedIntervalDays: number;
  defaultPrice: string;
  defaultInstallments: number;
  allowsDiscount: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanListResponse {
  data: Plan[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlanFormValues {
  name: string;
  description?: string;
  durationMonths: number;
  suggestedAppointments: number;
  suggestedIntervalDays: number;
  defaultPrice: number;
  defaultInstallments: number;
  allowsDiscount?: boolean;
  isActive?: boolean;
  notes?: string;
}

export interface NutritionistOption {
  id: string;
  name: string;
}

export interface ProfessionalProfile {
  id: string;
  tenantId: string;
  displayName: string;
  professionalName: string;
  professionalTitle: string | null;
  crnNumber: string | null;
  crnState: string | null;
  specialty: string | null;
  shortBio: string | null;
  profilePhotoKey: string | null;
  profilePhotoUrl: string | null;
  logoKey: string | null;
  logoUrl: string | null;
  primaryPhone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  instagram: string | null;
  website: string | null;
  companyName: string | null;
  legalName: string | null;
  documentNumber: string | null;
  addressLine: string | null;
  paletteKey: string | null;
  primaryColor: string;
  secondaryColor: string;
  createdAt: string;
  updatedAt: string;
}

export type UpdateProfessionalProfileValues = Partial<
  Pick<
    ProfessionalProfile,
    | 'displayName'
    | 'professionalName'
    | 'professionalTitle'
    | 'crnNumber'
    | 'crnState'
    | 'specialty'
    | 'shortBio'
    | 'primaryPhone'
    | 'whatsappPhone'
    | 'email'
    | 'instagram'
    | 'website'
    | 'companyName'
    | 'legalName'
    | 'documentNumber'
    | 'addressLine'
    | 'paletteKey'
    | 'primaryColor'
    | 'secondaryColor'
  >
>;

export interface ProfessionalPalettePreset {
  key: string;
  label: string;
  primaryColor: string;
  secondaryColor: string;
}

export const PROFESSIONAL_PALETTE_PRESETS: ProfessionalPalettePreset[] = [
  { key: 'sage', label: 'Sálvia', primaryColor: '#3F7658', secondaryColor: '#8CAF9A' },
  { key: 'ocean', label: 'Oceano', primaryColor: '#2A6F97', secondaryColor: '#89C2D9' },
  { key: 'terracotta', label: 'Terracota', primaryColor: '#B4592C', secondaryColor: '#E0A377' },
  { key: 'plum', label: 'Ameixa', primaryColor: '#7A4069', secondaryColor: '#C08AAE' },
  { key: 'slate', label: 'Ardósia', primaryColor: '#3E5164', secondaryColor: '#94A7B8' },
  { key: 'amber', label: 'Âmbar', primaryColor: '#B3801A', secondaryColor: '#E5C07B' },
];

export type BodySegmentEnum = 'RIGHT_ARM' | 'LEFT_ARM' | 'TRUNK' | 'RIGHT_LEG' | 'LEFT_LEG';
export type SegmentalMetricTypeEnum = 'FAT_MASS_KG' | 'LEAN_MASS_KG';
export type EvolutionPhotoTypeEnum = 'FRONT' | 'BACK' | 'RIGHT_PROFILE' | 'LEFT_PROFILE' | 'OTHER';
export type SilhouettePreference = 'MALE' | 'FEMALE' | 'NEUTRAL' | 'NOT_INFORMED';

export const EVOLUTION_PHOTO_TYPE_LABELS: Record<EvolutionPhotoTypeEnum, string> = {
  FRONT: 'Frente',
  BACK: 'Costas',
  RIGHT_PROFILE: 'Perfil direito',
  LEFT_PROFILE: 'Perfil esquerdo',
  OTHER: 'Outra',
};

export interface AnthropometricMeasurement {
  weightKg: string | null;
  heightCm: string | null;
  bmi: string | null;
  bmiClassification: string | null;
  desiredWeightKg: string | null;
  neckCm: string | null;
  shoulderCm: string | null;
  chestCm: string | null;
  waistCm: string | null;
  abdomenCm: string | null;
  hipCm: string | null;
  gluteCm: string | null;
  rightArmCm: string | null;
  leftArmCm: string | null;
  rightForearmCm: string | null;
  leftForearmCm: string | null;
  rightThighCm: string | null;
  leftThighCm: string | null;
  rightCalfCm: string | null;
  leftCalfCm: string | null;
  tricepsSkinfoldMm: string | null;
  bicepsSkinfoldMm: string | null;
  subscapularSkinfoldMm: string | null;
  suprailiacSkinfoldMm: string | null;
  abdominalSkinfoldMm: string | null;
  chestSkinfoldMm: string | null;
  midaxillarySkinfoldMm: string | null;
  thighSkinfoldMm: string | null;
  calfSkinfoldMm: string | null;
}

export interface BioimpedanceMeasurement {
  bodyFatPercent: string | null;
  fatMassKg: string | null;
  leanMassKg: string | null;
  muscleMassKg: string | null;
  skeletalMuscleMassKg: string | null;
  musclePercent: string | null;
  bodyWaterLiters: string | null;
  bodyWaterPercent: string | null;
  proteinKg: string | null;
  proteinPercent: string | null;
  mineralMassKg: string | null;
  boneMassKg: string | null;
  visceralFatLevel: string | null;
  basalMetabolicRateKcal: number | null;
  metabolicAge: number | null;
  waistHipRatio: string | null;
  obesityDegreePercent: string | null;
  bodyType: string | null;
  impedanceOhms: string | null;
  deviceManufacturer: string | null;
  notes: string | null;
  bodyCompositionScore: number | null;
  bodyCompositionScoreMaximum: number | null;
  bodyCompositionScoreLabel: string | null;
  bodyCompositionScoreSource: string | null;
  referenceWeightKg: string | null;
  recommendedWeightChangeKg: string | null;
  recommendedFatChangeKg: string | null;
  recommendedMuscleChangeKg: string | null;
  segmentalImpedanceMeasurements: SegmentalImpedanceMeasurement[];
}

export interface SegmentalBodyMeasurement {
  id: string;
  segment: BodySegmentEnum;
  metricType: SegmentalMetricTypeEnum;
  valueKg: string;
  isEstimated: boolean;
  referenceMinKg: string | null;
  referenceMaxKg: string | null;
}

export interface SegmentalImpedanceMeasurement {
  id: string;
  frequencyValue: string;
  frequencyUnit: string;
  rightArmOhms: string | null;
  leftArmOhms: string | null;
  trunkOhms: string | null;
  rightLegOhms: string | null;
  leftLegOhms: string | null;
  impedanceUnit: string;
  deviceManufacturer: string | null;
  notes: string | null;
}

export interface MeasurementReferenceRange {
  id: string;
  fieldKey: string;
  minValue: string | null;
  maxValue: string | null;
  unit: string | null;
  source: string | null;
  note: string | null;
}

export interface EvolutionPhoto {
  id: string;
  type: EvolutionPhotoTypeEnum;
  url: string;
  createdAt: string;
}

export interface PatientEvolution {
  id: string;
  patientId: string;
  assessmentDate: string;
  assessmentTime: string | null;
  title: string | null;
  objective: string | null;
  clinicalNotes: string | null;
  internalNotes: string | null;
  patientVisibleNotes: string | null;
  isSharedWithPatient: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  nutritionistUser: { id: string; name: string };
  createdByUser: { id: string; name: string };
  appointment: { id: string; scheduledAt: string; appointmentType: { name: string } } | null;
  anthropometry: AnthropometricMeasurement | null;
  bioimpedance: BioimpedanceMeasurement | null;
  segmentalMeasurements: SegmentalBodyMeasurement[];
  referenceRanges: MeasurementReferenceRange[];
  photos: EvolutionPhoto[];
  createdAt: string;
  updatedAt: string;
}

export type EvolutionFormAnthropometry = Partial<Record<keyof AnthropometricMeasurement, number>>;
export type EvolutionFormBioimpedance = Partial<
  Record<Exclude<keyof BioimpedanceMeasurement, 'bodyType' | 'deviceManufacturer' | 'notes' | 'bodyCompositionScoreLabel' | 'bodyCompositionScoreSource' | 'segmentalImpedanceMeasurements'>, number>
>;

export interface EvolutionFormSegmentalMeasurement {
  segment: BodySegmentEnum;
  metricType: SegmentalMetricTypeEnum;
  valueKg: number;
  isEstimated?: boolean;
  referenceMinKg?: number;
  referenceMaxKg?: number;
}

export interface EvolutionFormSegmentalImpedance {
  frequencyValue: number;
  frequencyUnit?: string;
  rightArmOhms?: number;
  leftArmOhms?: number;
  trunkOhms?: number;
  rightLegOhms?: number;
  leftLegOhms?: number;
  impedanceUnit?: string;
  deviceManufacturer?: string;
  notes?: string;
}

export interface EvolutionFormReferenceRange {
  fieldKey: string;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  source?: string;
  note?: string;
}

export interface EvolutionFormValues {
  assessmentDate: string;
  assessmentTime?: string;
  title?: string;
  objective?: string;
  clinicalNotes?: string;
  internalNotes?: string;
  nutritionistUserId?: string;
  appointmentId?: string;
  anthropometry?: EvolutionFormAnthropometry;
  bioimpedance?: EvolutionFormBioimpedance & { bodyType?: string; deviceManufacturer?: string; notes?: string };
  segmentalMeasurements?: EvolutionFormSegmentalMeasurement[];
  segmentalImpedanceMeasurements?: EvolutionFormSegmentalImpedance[];
  referenceRanges?: EvolutionFormReferenceRange[];
}

// ============================================================================
// Agenda / Consultas (Missão 0004)
// ============================================================================

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELLED_BY_CLINIC'
  | 'CANCELLED_BY_PATIENT'
  | 'NO_SHOW'
  | 'RESCHEDULED';

export type AppointmentModality = 'IN_PERSON' | 'ONLINE' | 'HOME_VISIT';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Agendada',
  AWAITING_CONFIRMATION: 'Aguardando confirmação',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'Em atendimento',
  DONE: 'Realizada',
  CANCELLED_BY_CLINIC: 'Cancelada pela profissional',
  CANCELLED_BY_PATIENT: 'Cancelada pelo paciente',
  NO_SHOW: 'Não compareceu',
  RESCHEDULED: 'Reagendada',
};

export const APPOINTMENT_MODALITY_LABELS: Record<AppointmentModality, string> = {
  IN_PERSON: 'Presencial',
  ONLINE: 'Online',
  HOME_VISIT: 'Domiciliar',
};

export interface AppointmentType {
  id: string;
  name: string;
  defaultDurationMinutes: number;
  color: string | null;
}

export interface AppointmentStatusHistoryEntry {
  id: string;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  reason: string | null;
  changedAt: string;
  changedByUser: { id: string; name: string };
}

export interface Appointment {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  modality: AppointmentModality;
  location: string | null;
  onlineMeetingUrl: string | null;
  adminNotes: string | null;
  clinicalNotes: string | null;
  patientVisibleNotes: string | null;
  confirmedAt: string | null;
  confirmationNotes: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  completedAt: string | null;
  noShowAt: string | null;
  patient: {
    id: string;
    fullName: string;
    primaryPhone: string | null;
    whatsappPhone: string | null;
    birthDate: string | null;
    status: PatientStatus;
  };
  nutritionistUser: { id: string; name: string };
  appointmentType: { id: string; name: string; color: string | null };
  createdByUser: { id: string; name: string };
  rescheduledFromAppointment: { id: string; scheduledAt: string } | null;
  rescheduledIntoAppointment: { id: string; scheduledAt: string } | null;
  statusHistory: AppointmentStatusHistoryEntry[];
  patientEvolutions: { id: string; assessmentDate: string; title: string | null }[];
}

export interface CreateAppointmentPayload {
  patientId: string;
  nutritionistUserId?: string;
  appointmentTypeId: string;
  scheduledAt: string;
  durationMinutes: number;
  modality: AppointmentModality;
  location?: string;
  onlineMeetingUrl?: string;
  adminNotes?: string;
  isConfirmed: boolean;
}

export interface UpdateAppointmentPayload {
  appointmentTypeId?: string;
  nutritionistUserId?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  modality?: AppointmentModality;
  location?: string;
  onlineMeetingUrl?: string;
  adminNotes?: string;
  clinicalNotes?: string;
}

export interface QueryAppointmentsParams {
  startDate?: string;
  endDate?: string;
  nutritionistId?: string;
  patientId?: string;
  status?: AppointmentStatus;
}
