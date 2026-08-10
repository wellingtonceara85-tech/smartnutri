import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TenantType } from '../../../generated/prisma/client';
import { PLAN_CODES, type PlanCode } from '../../../common/plans/plan-catalog';

/**
 * Cria um novo cliente (tenant) e seu usuário proprietário, de forma
 * transacional (Missão 0005.5, seção 21). O proprietário sempre recebe
 * papel ADMIN no próprio tenant — para SOLO isso já cobre integralmente
 * as funções clínicas necessárias (ver auditoria da missão).
 */
export class CreateTenantDto {
  @ApiProperty({ enum: TenantType })
  @IsEnum(TenantType)
  type: TenantType;

  @ApiProperty({
    description:
      'Nome da clínica, ou nome profissional se for nutricionista independente',
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description:
      'Nome de quem vai ser o usuário proprietário/administrador deste cliente',
  })
  @IsString()
  @MinLength(2)
  responsibleName: string;

  @ApiProperty({
    description:
      'E-mail de login do proprietário — também usado como contato do cliente',
  })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty({
    enum: PLAN_CODES,
    description:
      'Plano contratado — precisa ser compatível com `type` (validado no serviço); planos internos (ex.: DEMO_INTERNAL) não são aceitos aqui.',
  })
  @IsIn(PLAN_CODES)
  planCode: PlanCode;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Se true, o cliente já nasce em TRIAL em vez de ACTIVE',
  })
  @IsOptional()
  @IsBoolean()
  startAsTrial?: boolean;
}
