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
