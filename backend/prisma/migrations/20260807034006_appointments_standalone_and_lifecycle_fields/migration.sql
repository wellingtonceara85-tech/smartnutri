/*
  Warnings:

  - Added the required column `createdByUserId` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmationNotes" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "createdByUserId" TEXT NOT NULL,
ADD COLUMN     "noShowAt" TIMESTAMP(3),
ADD COLUMN     "onlineMeetingUrl" TEXT,
ADD COLUMN     "patientVisibleNotes" TEXT,
ADD COLUMN     "updatedByUserId" TEXT,
ALTER COLUMN "treatmentCycleId" DROP NOT NULL,
ALTER COLUMN "sequenceNumber" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
