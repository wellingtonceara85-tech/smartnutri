import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TenantStatus, TenantType } from '../../../generated/prisma/client';

export class QueryPlatformTenantsDto {
  @ApiProperty({
    required: false,
    description: 'Busca por nome ou e-mail do cliente',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiProperty({ required: false, enum: TenantType })
  @IsOptional()
  @IsEnum(TenantType)
  type?: TenantType;

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

  @ApiProperty({
    required: false,
    enum: ['name', 'createdAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['name', 'createdAt'])
  sortBy?: 'name' | 'createdAt' = 'createdAt';

  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
