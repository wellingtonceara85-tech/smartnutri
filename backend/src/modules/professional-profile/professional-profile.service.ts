import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  AuditAction,
  Prisma,
  ProfessionalProfile,
} from '../../generated/prisma/client';
import { UpdateProfessionalProfileDto } from './dto/update-professional-profile.dto';

type ProfessionalProfileWithUrls = ProfessionalProfile & {
  profilePhotoUrl: string | null;
  logoUrl: string | null;
};

@Injectable()
export class ProfessionalProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Garante que todo tenant tenha um ProfessionalProfile — cria com
   * valores derivados do Tenant na primeira leitura, já que a migração
   * que introduziu este modelo não retroagiu sobre tenants existentes.
   */
  async getOwn(tenantId: string): Promise<ProfessionalProfileWithUrls> {
    return this.enrichWithUrls(await this.findOrCreate(tenantId));
  }

  async updateOwn(
    tenantId: string,
    dto: UpdateProfessionalProfileDto,
    actorUserId: string,
  ): Promise<ProfessionalProfileWithUrls> {
    const before = await this.findOrCreate(tenantId);

    const updated = await this.prisma.professionalProfile.update({
      where: { tenantId },
      data: dto,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'ProfessionalProfile',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      before: this.toAuditJson(before),
      after: this.toAuditJson(updated),
    });

    return this.enrichWithUrls(updated);
  }

  async updateProfilePhoto(
    tenantId: string,
    actorUserId: string,
    file: Express.Multer.File,
  ): Promise<ProfessionalProfileWithUrls> {
    const before = await this.findOrCreate(tenantId);
    const key = await this.storeImage(tenantId, 'photo', file);

    const updated = await this.prisma.professionalProfile.update({
      where: { tenantId },
      data: { profilePhotoKey: key },
    });
    await this.cleanupOldKey(before.profilePhotoKey);

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'ProfessionalProfile',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      before: this.toAuditJson(before),
      after: this.toAuditJson(updated),
      metadata: { field: 'profilePhotoKey' },
    });

    return this.enrichWithUrls(updated);
  }

  async updateLogo(
    tenantId: string,
    actorUserId: string,
    file: Express.Multer.File,
  ): Promise<ProfessionalProfileWithUrls> {
    const before = await this.findOrCreate(tenantId);
    const key = await this.storeImage(tenantId, 'logo', file);

    const updated = await this.prisma.professionalProfile.update({
      where: { tenantId },
      data: { logoKey: key },
    });
    await this.cleanupOldKey(before.logoKey);

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'ProfessionalProfile',
      entityId: updated.id,
      action: AuditAction.UPDATE,
      before: this.toAuditJson(before),
      after: this.toAuditJson(updated),
      metadata: { field: 'logoKey' },
    });

    return this.enrichWithUrls(updated);
  }

  private async findOrCreate(tenantId: string): Promise<ProfessionalProfile> {
    const existing = await this.prisma.professionalProfile.findUnique({
      where: { tenantId },
    });
    if (existing) {
      return existing;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    return this.prisma.professionalProfile.create({
      data: {
        tenantId,
        displayName: tenant.name,
        professionalName: tenant.name,
        primaryPhone: tenant.phone,
        email: tenant.email,
      },
    });
  }

  private async enrichWithUrls(
    profile: ProfessionalProfile,
  ): Promise<ProfessionalProfileWithUrls> {
    const [profilePhotoUrl, logoUrl] = await Promise.all([
      profile.profilePhotoKey
        ? this.storage.getDownloadUrl(profile.profilePhotoKey)
        : Promise.resolve(null),
      profile.logoKey
        ? this.storage.getDownloadUrl(profile.logoKey)
        : Promise.resolve(null),
    ]);
    return { ...profile, profilePhotoUrl, logoUrl };
  }

  private async storeImage(
    tenantId: string,
    prefix: 'photo' | 'logo',
    file: Express.Multer.File,
  ): Promise<string> {
    const extension = this.extensionFromMime(file.mimetype);
    const key = `professional-profile/${tenantId}/${prefix}-${randomUUID()}.${extension}`;
    await this.storage.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });
    return key;
  }

  private async cleanupOldKey(key: string | null): Promise<void> {
    if (!key) {
      return;
    }
    try {
      await this.storage.delete(key);
    } catch {
      // best-effort — não bloqueia a resposta se a limpeza do objeto antigo falhar
    }
  }

  private extensionFromMime(mimeType: string): string {
    switch (mimeType) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return 'jpg';
    }
  }

  private toAuditJson(profile: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(profile)) as Prisma.InputJsonValue;
  }
}
