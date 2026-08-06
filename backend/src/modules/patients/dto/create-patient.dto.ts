import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Gender, SilhouettePreference } from '../../../generated/prisma/client';
import { IsValidCpf } from '../../../common/validators/is-valid-cpf.decorator';
import { IsValidPhone } from '../../../common/validators/is-valid-phone.decorator';

export class CreatePatientDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  socialName?: string;

  @ApiProperty({
    required: false,
    description: 'Com ou sem máscara — é normalizado no backend',
  })
  @IsOptional()
  @IsValidCpf()
  cpf?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ required: false, enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    required: false,
    enum: SilhouettePreference,
    description:
      'Preferência de silhueta para o mapa corporal — nunca inferida automaticamente do gênero.',
  })
  @IsOptional()
  @IsEnum(SilhouettePreference)
  bodySilhouettePreference?: SilhouettePreference;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsValidPhone()
  primaryPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsValidPhone()
  secondaryPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsValidPhone()
  whatsappPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsValidPhone()
  emergencyContactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  administrativeNotes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  responsibleNutritionistId?: string;
}
