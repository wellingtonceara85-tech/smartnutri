import { PartialType } from '@nestjs/swagger';
import { CreateEvolutionDto } from './create-evolution.dto';

export class UpdateEvolutionDto extends PartialType(CreateEvolutionDto) {}
