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
import { EvolutionPhotoType, Role } from '../../generated/prisma/client';
import { ShareEvolutionDto } from './dto/share-evolution.dto';
import { UpdateEvolutionDto } from './dto/update-evolution.dto';
import { EvolutionsService } from './evolutions.service';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const photoUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
});

/** RECEPTION nunca recebe @Roles aqui — blackout completo do módulo clínico. */
@ApiTags('evolutions')
@ApiBearerAuth()
@Controller('evolutions')
@Roles(Role.ADMIN, Role.NUTRITIONIST)
export class EvolutionsController {
  constructor(private readonly evolutionsService: EvolutionsService) {}

  @Get(':id')
  getById(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evolutionsService.getById(tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvolutionDto,
  ) {
    return this.evolutionsService.update(tenantId, user.userId, id, dto);
  }

  @Delete(':id')
  archive(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evolutionsService.archive(tenantId, user.userId, id);
  }

  @Patch(':id/share')
  share(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareEvolutionDto,
  ) {
    return this.evolutionsService.share(tenantId, user.userId, id, dto);
  }

  @Post(':id/photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(photoUploadInterceptor)
  addPhoto(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) evolutionId: string,
    @Body('type') type?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo obrigatório');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato de imagem não suportado (use JPEG, PNG ou WebP)',
      );
    }
    if (
      !type ||
      !Object.values(EvolutionPhotoType).includes(type as EvolutionPhotoType)
    ) {
      throw new BadRequestException('Tipo de foto inválido');
    }
    return this.evolutionsService.addPhoto(
      tenantId,
      user.userId,
      evolutionId,
      type as EvolutionPhotoType,
      file,
    );
  }

  @Delete(':id/photos/:photoId')
  removePhoto(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) evolutionId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.evolutionsService.removePhoto(
      tenantId,
      user.userId,
      evolutionId,
      photoId,
    );
  }
}
