import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CycleStatus } from '../../../generated/prisma/client';

export class UpdateTreatmentCycleStatusDto {
  @ApiProperty({ enum: CycleStatus })
  @IsEnum(CycleStatus)
  status: CycleStatus;

  @ApiProperty({
    required: false,
    description: 'Motivo, quando aplicável (ex.: cancelamento)',
  })
  @IsOptional()
  @IsString()
  closureReason?: string;
}
