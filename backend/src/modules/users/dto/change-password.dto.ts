import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Senha atual, para confirmar que é o próprio usuário' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ description: 'Nova senha — mesma regra mínima já usada ao criar um usuário' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
