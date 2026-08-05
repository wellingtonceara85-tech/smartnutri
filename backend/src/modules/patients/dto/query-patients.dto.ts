import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PatientStatus } from '../../../generated/prisma/client';

export class QueryPatientsDto {
  @ApiProperty({
    required: false,
    description: 'Busca por nome, nome social, CPF, telefone ou e-mail',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: PatientStatus })
  @IsOptional()
  @IsEnum(PatientStatus)
  status?: PatientStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  responsibleNutritionistId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  source?: string;

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
    enum: ['fullName', 'createdAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['fullName', 'createdAt'])
  sortBy?: 'fullName' | 'createdAt' = 'createdAt';

  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
