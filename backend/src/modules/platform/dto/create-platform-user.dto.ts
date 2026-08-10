import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, IsUUID, MinLength } from 'class-validator';
import { Role } from '../../../generated/prisma/client';

/**
 * Criação de usuário de tenant pelo Platform Admin (Missão 0005.6). Nunca
 * recebe senha do chamador — sempre gerada pelo backend e devolvida uma
 * única vez na resposta (mesmo padrão de CreateTenantDto).
 */
export class CreatePlatformUserDto {
  @ApiProperty({ description: 'Cliente (tenant) ao qual o usuário pertencerá' })
  @IsUUID()
  tenantId: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}
