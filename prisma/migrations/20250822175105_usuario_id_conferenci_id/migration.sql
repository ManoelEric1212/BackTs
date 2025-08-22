/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId,conferenciaId]` on the table `Participacao` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Participacao_usuarioId_conferenciaId_key" ON "Participacao"("usuarioId", "conferenciaId");
