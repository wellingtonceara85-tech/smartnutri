import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  AppointmentModality,
  DiscountType,
} from '../../../generated/prisma/client';

/**
 * Agendamento avulso — não exige TreatmentCycle/Plan. `isConfirmed` decide o
 * status inicial (CONFIRMED ou AWAITING_CONFIRMATION); nunca SCHEDULED por
 * padrão, para que toda consulta nova passe por uma decisão explícita de
 * confirmação (seção 21 do prompt da missão).
 *
 * `treatmentCycleId` e os campos `standalone*` (Missão 0005.8) são
 * mutuamente exclusivos: uma consulta vinculada a um ciclo já tem seu valor
 * definido pela contratação — não se pede valor/desconto de novo; uma
 * consulta avulsa pode opcionalmente registrar os seus.
 */
export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty({
    required: false,
    description:
      'Vincula a consulta a um ciclo de tratamento ativo do paciente.',
  })
  @IsOptional()
  @IsUUID()
  treatmentCycleId?: string;

  @ApiProperty({
    required: false,
    description: 'Valor da consulta avulsa (sem treatmentCycleId)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  standaloneValue?: number;

  @ApiProperty({ enum: DiscountType, required: false })
  @IsOptional()
  @IsEnum(DiscountType)
  standaloneDiscountType?: DiscountType;

  @ApiProperty({
    required: false,
    description:
      'Em R$ se standaloneDiscountType=FIXED, ou o percentual (ex.: 10) se PERCENTAGE',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  standaloneDiscountValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  standalonePaymentMethodId?: string;

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
