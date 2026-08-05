-- Unicidade de nome de plano por clínica apenas entre planos não excluídos.
-- Índice único parcial (não expressável diretamente no schema.prisma) para
-- permitir reaproveitar o nome de um plano após ele ser excluído/arquivado.
CREATE UNIQUE INDEX "Plan_tenantId_name_active_unique"
  ON "Plan" ("tenantId", "name")
  WHERE "deletedAt" IS NULL;
