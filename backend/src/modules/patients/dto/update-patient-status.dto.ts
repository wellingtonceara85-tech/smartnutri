import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PatientStatus } from '../../../generated/prisma/client';

export class UpdatePatientStatusDto {
  @ApiProperty({ enum: PatientStatus })
  @IsEnum(PatientStatus)
  status: PatientStatus;

  @ApiProperty({
    required: false,
    description: 'Motivo da mudança de status, para auditoria',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
