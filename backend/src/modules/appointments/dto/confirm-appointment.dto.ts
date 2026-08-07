import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConfirmAppointmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  confirmationNotes?: string;
}
