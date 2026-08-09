import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Edição de dados gerais do cliente pelo Platform Admin. Deliberadamente
 * não inclui `status`/`type` — mudança de status passa pelos endpoints
 * dedicados activate/suspend (auditáveis, explícitos); `type` não é
 * editável após a criação nesta missão.
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  planCode?: string;
}
