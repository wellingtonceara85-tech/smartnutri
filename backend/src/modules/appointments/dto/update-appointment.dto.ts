import { ApiProperty } from '@nestjs/swagger';
import {
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
 * Edição administrativa/pontual (tipo, modalidade, local, notas, ou correção
 * de data/duração). Reagendamento formal com histórico preservado usa o
 * endpoint /reschedule, não este. Ainda assim, se scheduledAt/durationMinutes
 * mudarem aqui, o conflito de horário é revalidado normalmente.
 */
export class UpdateAppointmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  appointmentTypeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  nutritionistUserId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(480)
  durationMinutes?: number;

  @ApiProperty({ required: false, enum: AppointmentModality })
  @IsOptional()
  @IsIn(Object.values(AppointmentModality))
  modality?: AppointmentModality;

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
    required: false,
    description:
      'Nota clínica interna — nunca visível ao paciente. RECEPTION não pode alterar.',
  })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;
}
