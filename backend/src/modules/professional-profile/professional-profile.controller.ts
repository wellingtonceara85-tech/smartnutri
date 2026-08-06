import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { Role } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { ProfessionalProfileService } from './professional-profile.service';
import { UpdateProfessionalProfileDto } from './dto/update-professional-profile.dto';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const imageUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
});

@ApiTags('professional-profile')
@ApiBearerAuth()
@Controller('professional-profile')
export class ProfessionalProfileController {
  constructor(
    private readonly professionalProfileService: ProfessionalProfileService,
  ) {}

  @Get('me')
  getOwn(@CurrentTenant() tenantId: string) {
    return this.professionalProfileService.getOwn(tenantId);
  }

  @Patch('me')
  @Roles(Role.ADMIN, Role.NUTRITIONIST)
  updateOwn(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfessionalProfileDto,
  ) {
    return this.professionalProfileService.updateOwn(
      tenantId,
      dto,
      user.userId,
    );
  }

  @Post('me/photo')
  @Roles(Role.ADMIN, Role.NUTRITIONIST)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(imageUploadInterceptor)
  uploadPhoto(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.assertValidImage(file);
    return this.professionalProfileService.updateProfilePhoto(
      tenantId,
      user.userId,
      file!,
    );
  }

  @Post('me/logo')
  @Roles(Role.ADMIN, Role.NUTRITIONIST)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(imageUploadInterceptor)
  uploadLogo(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.assertValidImage(file);
    return this.professionalProfileService.updateLogo(
      tenantId,
      user.userId,
      file!,
    );
  }

  private assertValidImage(file?: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Arquivo obrigatório');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato de imagem não suportado (use JPEG, PNG ou WebP)',
      );
    }
  }
}
