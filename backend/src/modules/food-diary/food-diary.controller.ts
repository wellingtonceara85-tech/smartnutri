import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { Role } from '../../generated/prisma/client';
import { ReviewFoodDiaryEntryDto } from './dto/review-food-diary-entry.dto';
import { UpdateFoodDiaryEntryDto } from './dto/update-food-diary-entry.dto';
import { FoodDiaryService } from './food-diary.service';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const photoUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
});

/** RECEPTION nunca recebe @Roles aqui — blackout completo do diário alimentar. */
@ApiTags('food-diary')
@ApiBearerAuth()
@Controller('food-diary')
@Roles(Role.ADMIN, Role.NUTRITIONIST)
export class FoodDiaryController {
  constructor(private readonly foodDiaryService: FoodDiaryService) {}

  @Get(':id')
  getById(@CurrentTenant() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.foodDiaryService.getById(tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFoodDiaryEntryDto,
  ) {
    return this.foodDiaryService.update(tenantId, user.userId, id, dto);
  }

  @Delete(':id')
  archive(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.foodDiaryService.archive(tenantId, user.userId, id);
  }

  @Post(':id/review')
  review(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewFoodDiaryEntryDto,
  ) {
    return this.foodDiaryService.review(tenantId, user.userId, id, dto);
  }

  @Post(':id/photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(photoUploadInterceptor)
  addPhoto(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) entryId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo obrigatório');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagem não suportado (use JPEG, PNG ou WebP)');
    }
    return this.foodDiaryService.addPhoto(tenantId, user.userId, entryId, file);
  }

  @Delete(':id/photos/:photoId')
  removePhoto(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) entryId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.foodDiaryService.removePhoto(tenantId, user.userId, entryId, photoId);
  }
}
