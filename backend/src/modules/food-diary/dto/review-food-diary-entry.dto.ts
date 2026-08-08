import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FoodDiaryStatus } from '../../../generated/prisma/client';

/**
 * Avaliação profissional — nunca julgamento automático, sempre texto livre
 * de um humano. `status` aceita apenas REVIEWED/NO_REVIEW_NEEDED (o serviço
 * rejeita PENDING_REVIEW, que é só o estado inicial).
 */
export class ReviewFoodDiaryEntryDto {
  @ApiProperty({ enum: FoodDiaryStatus })
  @IsEnum(FoodDiaryStatus)
  status!: FoodDiaryStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nutritionistFeedback?: string;
}
