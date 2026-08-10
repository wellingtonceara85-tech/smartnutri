import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  Role,
  TenantStatus,
  TenantType,
} from '../../../generated/prisma/client';

export class QueryPlatformUsersDto {
  @ApiProperty({
    required: false,
    description: 'Busca por nome/e-mail do usuário ou nome do cliente',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    description: 'Filtra por um cliente específico',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiProperty({
    required: false,
    enum: Role,
    description: 'Filtra por perfil',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({
    required: false,
    description: 'true = usuários ativos, false = suspensos',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, enum: TenantType })
  @IsOptional()
  @IsEnum(TenantType)
  tenantType?: TenantType;

  @ApiProperty({ required: false, enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  tenantStatus?: TenantStatus;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
