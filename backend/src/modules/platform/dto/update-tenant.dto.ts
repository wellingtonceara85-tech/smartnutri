import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Edição de dados gerais do cliente pelo Platform Admin. Deliberadamente
 * não inclui `status`/`type`/`planCode` — mudança de status passa pelos
 * endpoints dedicados activate/suspend, e troca de plano pelo endpoint
 * dedicado `PATCH /platform/tenants/:id/plan` (Missão 0005.7), que precisa
 * validar compatibilidade com o uso atual antes de aplicar. `type` não é
 * editável após a criação.
 */
export class UpdateTenantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}
