import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { CycleStatus } from '../../../generated/prisma/client';

export class QueryTreatmentCyclesDto {
  @ApiProperty({ required: false, enum: CycleStatus })
  @IsOptional()
  @IsEnum(CycleStatus)
  status?: CycleStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  patientId?: string;

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
