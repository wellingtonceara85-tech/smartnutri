-- AlterTable
ALTER TABLE "BioimpedanceMeasurement" ADD COLUMN     "bodyCompositionScore" INTEGER,
ADD COLUMN     "bodyCompositionScoreLabel" TEXT,
ADD COLUMN     "bodyCompositionScoreMaximum" INTEGER,
ADD COLUMN     "bodyCompositionScoreSource" TEXT,
ADD COLUMN     "mineralMassKg" DECIMAL(5,2),
ADD COLUMN     "recommendedFatChangeKg" DECIMAL(6,2),
ADD COLUMN     "recommendedMuscleChangeKg" DECIMAL(6,2),
ADD COLUMN     "recommendedWeightChangeKg" DECIMAL(6,2),
ADD COLUMN     "referenceWeightKg" DECIMAL(6,2);

-- AlterTable
ALTER TABLE "SegmentalBodyMeasurement" ADD COLUMN     "isEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referenceMaxKg" DECIMAL(5,2),
ADD COLUMN     "referenceMinKg" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "SegmentalImpedanceMeasurement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bioimpedanceMeasurementId" TEXT NOT NULL,
    "frequencyValue" DECIMAL(7,2) NOT NULL,
    "frequencyUnit" TEXT NOT NULL DEFAULT 'kHz',
    "rightArmOhms" DECIMAL(7,2),
    "leftArmOhms" DECIMAL(7,2),
    "trunkOhms" DECIMAL(7,2),
    "rightLegOhms" DECIMAL(7,2),
    "leftLegOhms" DECIMAL(7,2),
    "impedanceUnit" TEXT NOT NULL DEFAULT 'ohm',
    "deviceManufacturer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentalImpedanceMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementReferenceRange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evolutionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "minValue" DECIMAL(8,2),
    "maxValue" DECIMAL(8,2),
    "unit" TEXT,
    "source" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeasurementReferenceRange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SegmentalImpedanceMeasurement_tenantId_idx" ON "SegmentalImpedanceMeasurement"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentalImpedanceMeasurement_bioimpedanceMeasurementId_fre_key" ON "SegmentalImpedanceMeasurement"("bioimpedanceMeasurementId", "frequencyValue");

-- CreateIndex
CREATE INDEX "MeasurementReferenceRange_tenantId_idx" ON "MeasurementReferenceRange"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementReferenceRange_evolutionId_fieldKey_key" ON "MeasurementReferenceRange"("evolutionId", "fieldKey");

-- AddForeignKey
ALTER TABLE "SegmentalImpedanceMeasurement" ADD CONSTRAINT "SegmentalImpedanceMeasurement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentalImpedanceMeasurement" ADD CONSTRAINT "SegmentalImpedanceMeasurement_bioimpedanceMeasurementId_fkey" FOREIGN KEY ("bioimpedanceMeasurementId") REFERENCES "BioimpedanceMeasurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReferenceRange" ADD CONSTRAINT "MeasurementReferenceRange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReferenceRange" ADD CONSTRAINT "MeasurementReferenceRange_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "PatientEvolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
