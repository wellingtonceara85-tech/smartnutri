import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AppointmentModality } from '../../../generated/prisma/client';

/**
 * Agendamento avulso — não exige TreatmentCycle/Plan. `isConfirmed` decide o
 * status inicial (CONFIRMED ou AWAITING_CONFIRMATION); nunca SCHEDULED por
 * padrão, para que toda consulta nova passe por uma decisão explícita de
 * confirmação (seção 21 do prompt da missão).
 */
export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty({
    required: false,
    description: 'Se omitido, assume o próprio autor (quando nutricionista).',
  })
  @IsOptional()
  @IsUUID()
  nutritionistUserId?: string;

  @ApiProperty()
  @IsUUID()
  appointmentTypeId!: string;

  @ApiProperty({ description: 'ISO 8601 com horário e offset/zulu' })
  @IsDateString()
  scheduledAt!: string;

  @ApiProperty({ default: 60 })
  @IsInt()
  @Min(10)
  @Max(480)
  durationMinutes!: number;

  @ApiProperty({
    enum: AppointmentModality,
    default: AppointmentModality.IN_PERSON,
  })
  @IsIn(Object.values(AppointmentModality))
  modality!: AppointmentModality;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  onlineMeetingUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @ApiProperty({
    default: true,
    description: 'true = já confirmada; false = aguardando confirmação',
  })
  @IsBoolean()
  isConfirmed!: boolean;
}
