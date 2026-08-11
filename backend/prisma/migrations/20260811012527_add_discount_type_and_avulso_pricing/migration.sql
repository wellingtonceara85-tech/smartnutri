-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "standaloneDiscountType" "DiscountType",
ADD COLUMN     "standaloneDiscountValue" DECIMAL(12,2),
ADD COLUMN     "standaloneFinalValue" DECIMAL(12,2),
ADD COLUMN     "standalonePaymentMethodId" TEXT,
ADD COLUMN     "standaloneValue" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "AppointmentStatusHistory" ADD COLUMN     "changedByRole" "Role";

-- AlterTable
ALTER TABLE "TreatmentCycle" ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMethodId" TEXT;

-- AddForeignKey
ALTER TABLE "TreatmentCycle" ADD CONSTRAINT "TreatmentCycle_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_standalonePaymentMethodId_fkey" FOREIGN KEY ("standalonePaymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
