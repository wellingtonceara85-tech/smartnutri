-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('SOLO', 'CLINIC');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "planCode" TEXT,
ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialStartsAt" TIMESTAMP(3),
ADD COLUMN     "type" "TenantType" NOT NULL DEFAULT 'CLINIC';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
