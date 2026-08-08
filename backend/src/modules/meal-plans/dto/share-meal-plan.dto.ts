import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Endpoint isolado de compartilhamento — nunca expõe internalNotes.
 * Preparação para o futuro Portal do Paciente, ainda não implementado.
 */
export class ShareMealPlanDto {
  @ApiProperty()
  @IsBoolean()
  isSharedWithPatient!: boolean;

  @ApiProperty({
    required: false,
    description:
      'Texto pensado para o paciente ler — nunca a nota interna da equipe.',
  })
  @IsOptional()
  @IsString()
  patientVisibleNotes?: string;
}
