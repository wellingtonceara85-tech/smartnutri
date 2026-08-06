/*
  Warnings:

  - You are about to drop the column `armCircumferenceCm` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `bmi` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `bodyFatPercent` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `goal` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `heightCm` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `hipCircumferenceCm` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `measuredAt` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `muscleMassKg` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `waistCircumferenceCm` on the `PatientEvolution` table. All the data in the column will be lost.
  - You are about to drop the column `weightKg` on the `PatientEvolution` table. All the data in the column will be lost.
  - Added the required column `assessmentDate` to the `PatientEvolution` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nutritionistUserId` to the `PatientEvolution` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SilhouettePreference" AS ENUM ('MALE', 'FEMALE', 'NEUTRAL', 'NOT_INFORMED');

-- CreateEnum
CREATE TYPE "EvolutionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BodySegment" AS ENUM ('RIGHT_ARM', 'LEFT_ARM', 'TRUNK', 'RIGHT_LEG', 'LEFT_LEG');

-- CreateEnum
CREATE TYPE "SegmentalMetricType" AS ENUM ('FAT_MASS_KG', 'LEAN_MASS_KG');

-- CreateEnum
CREATE TYPE "EvolutionPhotoType" AS ENUM ('FRONT', 'BACK', 'RIGHT_PROFILE', 'LEFT_PROFILE', 'OTHER');

-- DropIndex
DROP INDEX "PatientEvolution_tenantId_patientId_measuredAt_idx";

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "bodySilhouettePreference" "SilhouettePreference" NOT NULL DEFAULT 'NOT_INFORMED';

-- AlterTable
ALTER TABLE "PatientEvolution" DROP COLUMN "armCircumferenceCm",
DROP COLUMN "bmi",
DROP COLUMN "bodyFatPercent",
DROP COLUMN "goal",
DROP COLUMN "heightCm",
DROP COLUMN "hipCircumferenceCm",
DROP COLUMN "measuredAt",
DROP COLUMN "muscleMassKg",
DROP COLUMN "notes",
DROP COLUMN "waistCircumferenceCm",
DROP COLUMN "weightKg",
ADD COLUMN     "assessmentDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "assessmentTime" TEXT,
ADD COLUMN     "clinicalNotes" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "isSharedWithPatient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nutritionistUserId" TEXT NOT NULL,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "patientVisibleNotes" TEXT,
ADD COLUMN     "sharedAt" TIMESTAMP(3),
ADD COLUMN     "sharedByUserId" TEXT,
ADD COLUMN     "status" "EvolutionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "professionalName" TEXT NOT NULL,
    "professionalTitle" TEXT,
    "crnNumber" TEXT,
    "crnState" TEXT,
    "specialty" TEXT,
    "shortBio" TEXT,
    "profilePhotoKey" TEXT,
    "logoKey" TEXT,
    "primaryPhone" TEXT,
    "whatsappPhone" TEXT,
    "email" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "companyName" TEXT,
    "legalName" TEXT,
    "documentNumber" TEXT,
    "addressLine" TEXT,
    "paletteKey" TEXT DEFAULT 'sage',
    "primaryColor" TEXT NOT NULL DEFAULT '#3F7658',
    "secondaryColor" TEXT NOT NULL DEFAULT '#8CAF9A',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnthropometricMeasurement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evolutionId" TEXT NOT NULL,
    "weightKg" DECIMAL(6,2),
    "heightCm" DECIMAL(5,2),
    "bmi" DECIMAL(5,2),
    "bmiClassification" TEXT,
    "desiredWeightKg" DECIMAL(6,2),
    "neckCm" DECIMAL(5,2),
    "shoulderCm" DECIMAL(5,2),
    "chestCm" DECIMAL(5,2),
    "waistCm" DECIMAL(5,2),
    "abdomenCm" DECIMAL(5,2),
    "hipCm" DECIMAL(5,2),
    "gluteCm" DECIMAL(5,2),
    "rightArmCm" DECIMAL(5,2),
    "leftArmCm" DECIMAL(5,2),
    "rightForearmCm" DECIMAL(5,2),
    "leftForearmCm" DECIMAL(5,2),
    "rightThighCm" DECIMAL(5,2),
    "leftThighCm" DECIMAL(5,2),
    "rightCalfCm" DECIMAL(5,2),
    "leftCalfCm" DECIMAL(5,2),
    "tricepsSkinfoldMm" DECIMAL(5,2),
    "bicepsSkinfoldMm" DECIMAL(5,2),
    "subscapularSkinfoldMm" DECIMAL(5,2),
    "suprailiacSkinfoldMm" DECIMAL(5,2),
    "abdominalSkinfoldMm" DECIMAL(5,2),
    "chestSkinfoldMm" DECIMAL(5,2),
    "midaxillarySkinfoldMm" DECIMAL(5,2),
    "thighSkinfoldMm" DECIMAL(5,2),
    "calfSkinfoldMm" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnthropometricMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BioimpedanceMeasurement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evolutionId" TEXT NOT NULL,
    "bodyFatPercent" DECIMAL(4,1),
    "fatMassKg" DECIMAL(6,2),
    "leanMassKg" DECIMAL(6,2),
    "muscleMassKg" DECIMAL(6,2),
    "skeletalMuscleMassKg" DECIMAL(6,2),
    "musclePercent" DECIMAL(4,1),
    "bodyWaterLiters" DECIMAL(5,2),
    "bodyWaterPercent" DECIMAL(4,1),
    "proteinKg" DECIMAL(5,2),
    "proteinPercent" DECIMAL(4,1),
    "boneMassKg" DECIMAL(5,2),
    "visceralFatLevel" DECIMAL(4,1),
    "basalMetabolicRateKcal" INTEGER,
    "metabolicAge" INTEGER,
    "waistHipRatio" DECIMAL(4,2),
    "obesityDegreePercent" DECIMAL(5,1),
    "bodyScore" INTEGER,
    "bodyType" TEXT,
    "impedanceOhms" DECIMAL(7,2),
    "deviceManufacturer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BioimpedanceMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentalBodyMeasurement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evolutionId" TEXT NOT NULL,
    "segment" "BodySegment" NOT NULL,
    "metricType" "SegmentalMetricType" NOT NULL,
    "valueKg" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentalBodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionPhoto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evolutionId" TEXT NOT NULL,
    "type" "EvolutionPhotoType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "consentGranted" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "consentNotes" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EvolutionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_tenantId_key" ON "ProfessionalProfile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AnthropometricMeasurement_evolutionId_key" ON "AnthropometricMeasurement"("evolutionId");

-- CreateIndex
CREATE INDEX "AnthropometricMeasurement_tenantId_idx" ON "AnthropometricMeasurement"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BioimpedanceMeasurement_evolutionId_key" ON "BioimpedanceMeasurement"("evolutionId");

-- CreateIndex
CREATE INDEX "BioimpedanceMeasurement_tenantId_idx" ON "BioimpedanceMeasurement"("tenantId");

-- CreateIndex
CREATE INDEX "SegmentalBodyMeasurement_tenantId_idx" ON "SegmentalBodyMeasurement"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentalBodyMeasurement_evolutionId_segment_metricType_key" ON "SegmentalBodyMeasurement"("evolutionId", "segment", "metricType");

-- CreateIndex
CREATE INDEX "EvolutionPhoto_tenantId_evolutionId_idx" ON "EvolutionPhoto"("tenantId", "evolutionId");

-- CreateIndex
CREATE INDEX "PatientEvolution_tenantId_patientId_assessmentDate_idx" ON "PatientEvolution"("tenantId", "patientId", "assessmentDate");

-- CreateIndex
CREATE INDEX "PatientEvolution_tenantId_status_idx" ON "PatientEvolution"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEvolution" ADD CONSTRAINT "PatientEvolution_nutritionistUserId_fkey" FOREIGN KEY ("nutritionistUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEvolution" ADD CONSTRAINT "PatientEvolution_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEvolution" ADD CONSTRAINT "PatientEvolution_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnthropometricMeasurement" ADD CONSTRAINT "AnthropometricMeasurement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnthropometricMeasurement" ADD CONSTRAINT "AnthropometricMeasurement_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "PatientEvolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BioimpedanceMeasurement" ADD CONSTRAINT "BioimpedanceMeasurement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BioimpedanceMeasurement" ADD CONSTRAINT "BioimpedanceMeasurement_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "PatientEvolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentalBodyMeasurement" ADD CONSTRAINT "SegmentalBodyMeasurement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentalBodyMeasurement" ADD CONSTRAINT "SegmentalBodyMeasurement_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "PatientEvolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionPhoto" ADD CONSTRAINT "EvolutionPhoto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionPhoto" ADD CONSTRAINT "EvolutionPhoto_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "PatientEvolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionPhoto" ADD CONSTRAINT "EvolutionPhoto_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
