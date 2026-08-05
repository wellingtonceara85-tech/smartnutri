import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdatePlanStatusDto {
  @ApiProperty({ description: 'true para ativar, false para inativar' })
  @IsBoolean()
  isActive: boolean;
}
