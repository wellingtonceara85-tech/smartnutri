import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

/** Chaves de paleta suportadas pelo ThemeProvider do frontend. */
export const PROFESSIONAL_PALETTE_KEYS = [
  'sage',
  'ocean',
  'terracotta',
  'plum',
  'slate',
  'amber',
] as const;

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class UpdateProfessionalProfileDto {
  @ApiProperty({
    required: false,
    description: 'Nome exibido no cabeçalho/saudação (nunca o nome do tenant).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  professionalName?: string;

  @ApiProperty({ required: false, example: 'Nutricionista Clínica' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  professionalTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  crnNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  crnState?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialty?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortBio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  primaryPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  whatsappPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  instagram?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  website?: string;

  @ApiProperty({
    required: false,
    description: 'Nome da clínica/empresa — opcional, nunca obrigatório.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine?: string;

  @ApiProperty({ required: false, enum: PROFESSIONAL_PALETTE_KEYS })
  @IsOptional()
  @IsIn(PROFESSIONAL_PALETTE_KEYS)
  paletteKey?: string;

  @ApiProperty({ required: false, example: '#3F7658' })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, {
    message: 'primaryColor deve ser um hex no formato #RRGGBB',
  })
  primaryColor?: string;

  @ApiProperty({ required: false, example: '#8CAF9A' })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, {
    message: 'secondaryColor deve ser um hex no formato #RRGGBB',
  })
  secondaryColor?: string;
}
