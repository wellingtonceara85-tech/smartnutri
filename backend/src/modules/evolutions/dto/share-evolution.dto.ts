import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Endpoint isolado de compartilhamento — nunca expõe clinicalNotes/internalNotes.
 * Preparação para o futuro Portal do Paciente, ainda não implementado.
 */
export class ShareEvolutionDto {
  @ApiProperty()
  @IsBoolean()
  isSharedWithPatient!: boolean;

  @ApiProperty({
    required: false,
    description:
      'Texto pensado para o paciente ler — nunca a nota clínica interna.',
  })
  @IsOptional()
  @IsString()
  patientVisibleNotes?: string;
}
