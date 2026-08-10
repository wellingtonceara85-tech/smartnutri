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

// ============================================================================
// Plano Alimentar & Diário Alimentar (Missão 0005)
// ============================================================================

export type MealPlanStatus = 'DRAFT' | 'ACTIVE' | 'REPLACED' | 'COMPLETED' | 'ARCHIVED';

export const MEAL_PLAN_STATUS_LABELS: Record<MealPlanStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  REPLACED: 'Substituído',
  COMPLETED: 'Concluído',
  ARCHIVED: 'Arquivado',
};

export type MealPlanOrganizationType = 'DAILY' | 'WEEKLY' | 'CUSTOM_CYCLE';

export const MEAL_PLAN_ORGANIZATION_TYPE_LABELS: Record<MealPlanOrganizationType, string> = {
  DAILY: 'Rotina diária',
  WEEKLY: 'Semanal',
  CUSTOM_CYCLE: 'Ciclo personalizado',
};

export type WeekDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  MONDAY: 'Segunda-feira',
  TUESDAY: 'Terça-feira',
  WEDNESDAY: 'Quarta-feira',
  THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export const WEEK_DAY_SHORT_LABELS: Record<WeekDay, string> = {
  MONDAY: 'Seg',
  TUESDAY: 'Ter',
  WEDNESDAY: 'Qua',
  THURSDAY: 'Qui',
  FRIDAY: 'Sex',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

export const WEEK_DAY_ORDER: WeekDay[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export interface MealItemSubstitution {
  id: string;
  description: string;
  quantity: string | null;
  unit: string | null;
  householdMeasure: string | null;
  notes: string | null;
  displayOrder: number;
}

export interface MealItem {
  id: string;
  description: string;
  quantity: string | null;
  unit: string | null;
  householdMeasure: string | null;
  instructions: string | null;
  displayOrder: number;
  substitutions: MealItemSubstitution[];
}

export interface Meal {
  id: string;
  name: string;
  scheduledTime: string | null;
  timeDescription: string | null;
  instructions: string | null;
  displayOrder: number;
  items: MealItem[];
}

export interface MealPlanDay {
  id: string;
  name: string;
  dayNumber: number | null;
  weekDay: WeekDay | null;
  displayOrder: number;
  notes: string | null;
  meals: Meal[];
}

export interface MealPlan {
  id: string;
  patientId: string;
  title: string;
  objective: string | null;
  customObjective: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  status: MealPlanStatus;
  version: number;
  parentMealPlanId: string | null;
  organizationType: MealPlanOrganizationType;
  cycleLength: number | null;
  generalGuidelines: string | null;
  dailyWaterGoalMl: number | null;
  patientVisibleNotes: string | null;
  internalNotes: string | null;
  isSharedWithPatient: boolean;
  sharedAt: string | null;
  sharedByUserId: string | null;
  nutritionistUser: { id: string; name: string };
  createdByUser: { id: string; name: string };
  updatedByUser: { id: string; name: string } | null;
  sharedByUser: { id: string; name: string } | null;
  appointment: { id: string; scheduledAt: string; appointmentType: { name: string } } | null;
  treatmentCycle: { id: string; cycleNumber: number } | null;
  days: MealPlanDay[];
  createdAt: string;
  updatedAt: string;
}

export interface MealItemSubstitutionFormValues {
  description: string;
  quantity?: number;
  unit?: string;
  householdMeasure?: string;
  notes?: string;
  displayOrder?: number;
}

export interface MealItemFormValues {
  description: string;
  quantity?: number;
  unit?: string;
  householdMeasure?: string;
  instructions?: string;
  displayOrder?: number;
  substitutions?: MealItemSubstitutionFormValues[];
}

export interface MealFormValues {
  name: string;
  scheduledTime?: string;
  timeDescription?: string;
  instructions?: string;
  displayOrder?: number;
  items?: MealItemFormValues[];
}

export interface MealPlanDayFormValues {
  name: string;
  dayNumber?: number;
  weekDay?: WeekDay;
  displayOrder?: number;
  notes?: string;
  meals?: MealFormValues[];
}

export interface MealPlanFormValues {
  title: string;
  objective?: string;
  customObjective?: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  nutritionistUserId?: string;
  appointmentId?: string;
  treatmentCycleId?: string;
  organizationType?: MealPlanOrganizationType;
  cycleLength?: number;
  generalGuidelines?: string;
  dailyWaterGoalMl?: number;
  patientVisibleNotes?: string;
  internalNotes?: string;
  days?: MealPlanDayFormValues[];
}

export type FoodDiarySource = 'PROFESSIONAL' | 'PATIENT_PORTAL';
export type FoodDiaryStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'NO_REVIEW_NEEDED';

export const FOOD_DIARY_STATUS_LABELS: Record<FoodDiaryStatus, string> = {
  PENDING_REVIEW: 'Aguardando avaliação',
  REVIEWED: 'Avaliado',
  NO_REVIEW_NEEDED: 'Sem necessidade de avaliação',
};

export interface FoodDiaryPhoto {
  id: string;
  url: string;
  originalFileName: string | null;
  createdAt: string;
}

export interface FoodDiaryEntry {
  id: string;
  patientId: string;
  mealPlanId: string | null;
  mealId: string | null;
  entryDate: string;
  entryTime: string | null;
  mealName: string;
  comment: string | null;
  source: FoodDiarySource;
  status: FoodDiaryStatus;
  nutritionistFeedback: string | null;
  createdByUser: { id: string; name: string } | null;
  reviewedByUser: { id: string; name: string } | null;
  reviewedAt: string | null;
  mealPlan: { id: string; title: string; version: number } | null;
  meal: { id: string; name: string; mealPlanDay: { id: string; name: string } | null } | null;
  photos: FoodDiaryPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface FoodDiaryEntryFormValues {
  entryDate: string;
  entryTime?: string;
  mealName: string;
  comment?: string;
  mealPlanId?: string;
  mealId?: string;
}

export interface ReviewFoodDiaryEntryValues {
  status: 'REVIEWED' | 'NO_REVIEW_NEEDED';
  nutritionistFeedback?: string;
}

export interface QueryFoodDiaryParams {
  status?: FoodDiaryStatus;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================================================
// Administração da Plataforma (Missão 0005.5)
// ============================================================================

export type TenantType = 'SOLO' | 'CLINIC';
export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
export type PlatformRole = 'ADMIN' | 'NUTRITIONIST' | 'RECEPTION';

export const TENANT_TYPE_LABELS: Record<TenantType, string> = {
  SOLO: 'Nutricionista independente',
  CLINIC: 'Clínica',
};

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  ADMIN: 'Administrador(a)',
  NUTRITIONIST: 'Nutricionista',
  RECEPTION: 'Recepção',
};

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  TRIAL: 'Em teste',
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
};

export interface PlatformDashboard {
  tenants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    cancelled: number;
    solo: number;
    clinic: number;
  };
  nutritionists: number;
  internalUsers: number;
  patients: number;
}

export interface PlatformTenantListItem {
  id: string;
  name: string;
  type: TenantType;
  status: TenantStatus;
  responsibleName: string | null;
  email: string;
  phone: string;
  planCode: string | null;
  trialEndsAt: string | null;
  userCount: number;
  patientCount: number;
  createdAt: string;
}

export interface PlatformTenantListResponse {
  data: PlatformTenantListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlatformTenantDetail extends PlatformTenantListItem {
  usage: {
    users: number;
    nutritionists: number;
    patients: number;
    appointments: number;
  };
}

export interface PlatformTenantUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'NUTRITIONIST' | 'RECEPTION';
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface CreateTenantFormValues {
  type: TenantType;
  name: string;
  responsibleName: string;
  email: string;
  phone: string;
  planCode?: string;
  startAsTrial?: boolean;
}

export interface CreateTenantResponse {
  tenant: PlatformTenantDetail;
  owner: {
    id: string;
    name: string;
    email: string;
    temporaryPassword: string;
  };
}

export interface UpdateTenantFormValues {
  name?: string;
  email?: string;
  phone?: string;
  planCode?: string;
}

export interface QueryPlatformTenantsParams {
  search?: string;
  status?: TenantStatus;
  type?: TenantType;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// Gestão de Usuários da Plataforma (Missão 0005.6)
// ============================================================================

export interface PlatformUserListItem {
  /** Id do vínculo (UserClinic) — identificador desta linha, não do User global. */
  id: string;
  userId: string;
  name: string;
  email: string;
  role: PlatformRole;
  isActive: boolean;
  tenantId: string;
  tenantName: string;
  tenantType: TenantType;
  tenantStatus: TenantStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PlatformUserListResponse {
  data: PlatformUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePlatformUserFormValues {
  tenantId: string;
  name: string;
  email: string;
  role: PlatformRole;
}

export interface CreatePlatformUserResponse {
  user: PlatformUserListItem;
  temporaryPassword: string;
}

export interface ResetPlatformUserPasswordResponse {
  temporaryPassword: string;
}

export interface QueryPlatformUsersParams {
  search?: string;
  tenantId?: string;
  role?: PlatformRole;
  isActive?: boolean;
  tenantType?: TenantType;
  tenantStatus?: TenantStatus;
  page?: number;
  pageSize?: number;
}
