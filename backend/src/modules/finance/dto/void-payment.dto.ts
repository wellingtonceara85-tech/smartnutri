import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VoidPaymentDto {
  @ApiProperty({
    description: 'Motivo da reversão — obrigatório, fica no AuditLog',
  })
  @IsString()
  @MinLength(3)
  reason!: string;
}
