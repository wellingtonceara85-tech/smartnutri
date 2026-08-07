import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CancelAppointmentDto {
  @ApiProperty({ description: 'Motivo do cancelamento — obrigatório' })
  @IsString()
  reason!: string;

  @ApiProperty({
    enum: ['PATIENT', 'CLINIC'],
    description: 'Quem decidiu cancelar — define o status final',
  })
  @IsIn(['PATIENT', 'CLINIC'])
  cancelledBy!: 'PATIENT' | 'CLINIC';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
