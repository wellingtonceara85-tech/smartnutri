import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteAppointmentDto {
  @ApiProperty({
    required: false,
    description: 'Nota clínica interna — nunca visível ao paciente.',
  })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @ApiProperty({
    required: false,
    description:
      'Nota visível ao paciente (preparado para o Portal do Paciente).',
  })
  @IsOptional()
  @IsString()
  patientVisibleNotes?: string;
}
