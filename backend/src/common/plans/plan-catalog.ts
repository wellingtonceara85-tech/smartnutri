import { Role, TenantType } from '../../generated/prisma/client';

/**
 * Fonte única do catálogo de planos/entitlements (Missão 0005.7). Nunca
 * espalhar `if (planCode === 'X')` em controllers/serviços/frontend — tudo
 * que depende de limite ou permissão de plano lê daqui.
 *
 * `Tenant.type` (SOLO/CLINIC) é a ESTRUTURA do cliente — nunca muda depois
 * de criado. `Tenant.planCode` é a CONTRATAÇÃO — pode mudar. Um plano só é
 * válido para o `tenantType` ao qual pertence (nunca "SOLO" plan numa
 * CLINIC nem vice-versa) — é isso que impede o plano virar um jeito
 * disfarçado de mudar a estrutura do tenant.
 */
export const PLAN_CODES = [
  'SOLO',
  'CLINIC_ESSENTIAL',
  'CLINIC_PRO',
  'CLINIC_PLUS',
  'DEMO_INTERNAL',
] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

export interface PlanDefinition {
  code: PlanCode;
  /** Nome de exibição — nunca o código bruto na UI. */
  displayName: string;
  /** Tipo de tenant ao qual este plano se aplica — nunca cruzado. */
  tenantType: TenantType;
  /** Quantidade de UserClinic ATIVOS que este plano permite (a licença). */
  maxUsers: number;
  /** Perfis que podem ser atribuídos a um novo membro sob este plano. */
  allowedRoles: Role[];
  /**
   * Planos internos (ex.: demonstração) nunca aparecem como opção normal
   * de contratação — só o Platform Admin pode atribuí-los, via troca de
   * plano explícita, nunca pelo fluxo comum de criação de cliente.
   */
  isInternal: boolean;
}

export const PLAN_CATALOG: Record<PlanCode, PlanDefinition> = {
  SOLO: {
    code: 'SOLO',
    displayName: 'Nutricionista Independente',
    tenantType: TenantType.SOLO,
    maxUsers: 1,
    allowedRoles: [Role.ADMIN],
    isInternal: false,
  },
  CLINIC_ESSENTIAL: {
    code: 'CLINIC_ESSENTIAL',
    displayName: 'Clínica Essencial',
    tenantType: TenantType.CLINIC,
    maxUsers: 3,
    allowedRoles: [Role.ADMIN, Role.NUTRITIONIST, Role.RECEPTION],
    isInternal: false,
  },
  CLINIC_PRO: {
    code: 'CLINIC_PRO',
    displayName: 'Clínica Pro',
    tenantType: TenantType.CLINIC,
    maxUsers: 8,
    allowedRoles: [Role.ADMIN, Role.NUTRITIONIST, Role.RECEPTION],
    isInternal: false,
  },
  CLINIC_PLUS: {
    code: 'CLINIC_PLUS',
    displayName: 'Clínica Plus',
    tenantType: TenantType.CLINIC,
    maxUsers: 15,
    allowedRoles: [Role.ADMIN, Role.NUTRITIONIST, Role.RECEPTION],
    isInternal: false,
  },
  /**
   * Ambiente interno de demonstração comercial (seção 15) — modelado como
   * mais um plano no catálogo, não como um campo/flag novo no schema.
   * Justificativa: "demo" é, na prática, exatamente uma contratação com
   * limites próprios e sem custo — o mesmo conceito que já existe para os
   * planos comerciais, só que com `isInternal: true` escondendo-o do
   * fluxo normal. Evita schema novo, migration e um segundo caminho de
   * código só para tratar "é demo?".
   */
  DEMO_INTERNAL: {
    code: 'DEMO_INTERNAL',
    displayName: 'Demonstração (uso interno)',
    tenantType: TenantType.CLINIC,
    maxUsers: 10,
    allowedRoles: [Role.ADMIN, Role.NUTRITIONIST, Role.RECEPTION],
    isInternal: true,
  },
};

/** Plano padrão quando o tenant ainda não tem `planCode` definido (tenants criados antes desta missão). */
function defaultPlanFor(tenantType: TenantType): PlanDefinition {
  return tenantType === TenantType.SOLO
    ? PLAN_CATALOG.SOLO
    : PLAN_CATALOG.CLINIC_ESSENTIAL;
}

export function isValidPlanCode(value: string): value is PlanCode {
  return (PLAN_CODES as readonly string[]).includes(value);
}

/**
 * Resolve o plano efetivo de um tenant. Nunca lança erro — um `planCode`
 * ausente, desconhecido ou incompatível com o `type` atual do tenant
 * (dado legado, ou uma linha nunca migrada) cai no plano padrão do tipo,
 * em vez de quebrar toda checagem de licença que depende disto.
 */
export function resolvePlanForTenant(tenant: {
  type: TenantType;
  planCode: string | null;
}): PlanDefinition {
  if (tenant.planCode && isValidPlanCode(tenant.planCode)) {
    const plan = PLAN_CATALOG[tenant.planCode];
    if (plan.tenantType === tenant.type) return plan;
  }
  return defaultPlanFor(tenant.type);
}

/** Planos selecionáveis no fluxo normal de criação/troca — nunca inclui planos internos. */
export function listSelectablePlans(tenantType: TenantType): PlanDefinition[] {
  return Object.values(PLAN_CATALOG).filter(
    (plan) => plan.tenantType === tenantType && !plan.isInternal,
  );
}
