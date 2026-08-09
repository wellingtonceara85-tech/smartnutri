-- Missão 0005.1 — introduz MealPlanDay entre MealPlan e Meal para suportar
-- rotina diária, plano semanal e ciclos personalizados.
--
-- Migration escrita manualmente (não via `prisma migrate dev`) porque o
-- passo de troca de FK em "Meal" (mealPlanId -> mealPlanDayId) exige um
-- backfill de dados que o gerador automático do Prisma recusa a fazer
-- sozinho. Sequência: cria as novas estruturas, popula um MealPlanDay
-- "Rotina diária" para cada MealPlan já existente, religa as refeições
-- existentes a esse dia e só então remove a coluna antiga. Nenhum dado é
-- perdido — todo MealPlan/Meal/MealItem/MealItemSubstitution existente
-- continua acessível, agora com um nível a mais de aninhamento.

-- CreateEnum
CREATE TYPE "MealPlanOrganizationType" AS ENUM ('DAILY', 'WEEKLY', 'CUSTOM_CYCLE');

-- CreateEnum
CREATE TYPE "WeekDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable: MealPlan ganha organizationType (default DAILY preserva os
-- planos existentes) e cycleLength (livre, só relevante em CUSTOM_CYCLE).
ALTER TABLE "MealPlan" ADD COLUMN "organizationType" "MealPlanOrganizationType" NOT NULL DEFAULT 'DAILY';
ALTER TABLE "MealPlan" ADD COLUMN "cycleLength" INTEGER;

-- CreateTable
CREATE TABLE "MealPlanDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dayNumber" INTEGER,
    "weekDay" "WeekDay",
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealPlanDay_tenantId_mealPlanId_idx" ON "MealPlanDay"("tenantId", "mealPlanId");

-- AddForeignKey
ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Meal ganha a nova FK ainda opcional, para permitir o backfill
-- antes de torná-la obrigatória.
ALTER TABLE "Meal" ADD COLUMN "mealPlanDayId" TEXT;

-- Backfill: um MealPlanDay "Rotina diária" por MealPlan existente.
INSERT INTO "MealPlanDay" ("id", "tenantId", "mealPlanId", "name", "dayNumber", "displayOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "tenantId", "id", 'Rotina diária', 1, 0, now(), now()
FROM "MealPlan";

-- Backfill: religa cada Meal existente ao MealPlanDay recém-criado do seu plano.
UPDATE "Meal" AS m
SET "mealPlanDayId" = d."id"
FROM "MealPlanDay" AS d
WHERE d."mealPlanId" = m."mealPlanId";

-- Remove a FK e o índice antigos de Meal -> MealPlan (agora indireto via MealPlanDay).
ALTER TABLE "Meal" DROP CONSTRAINT "Meal_mealPlanId_fkey";
DROP INDEX "Meal_tenantId_mealPlanId_idx";
ALTER TABLE "Meal" DROP COLUMN "mealPlanId";

-- Torna a nova FK obrigatória agora que todo Meal já foi religado.
ALTER TABLE "Meal" ALTER COLUMN "mealPlanDayId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Meal_tenantId_mealPlanDayId_idx" ON "Meal"("tenantId", "mealPlanDayId");

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_mealPlanDayId_fkey" FOREIGN KEY ("mealPlanDayId") REFERENCES "MealPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
