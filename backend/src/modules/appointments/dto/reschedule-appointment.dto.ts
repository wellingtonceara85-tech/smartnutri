import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({ description: 'Nova data/horário, ISO 8601' })
  @IsDateString()
  newScheduledAt!: string;

  @ApiProperty({
    required: false,
    description: 'Se omitido, mantém a duração original',
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(480)
  newDurationMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
