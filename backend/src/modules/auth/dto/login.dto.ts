import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@clinicademo.com.br' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha-forte-123' })
  @IsString()
  @MinLength(6)
  password: string;
}
