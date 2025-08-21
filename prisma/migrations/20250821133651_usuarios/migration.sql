/*
  Warnings:

  - You are about to drop the column `dataConferencia` on the `Conferencia` table. All the data in the column will be lost.
  - You are about to drop the column `usuario` on the `Conferencia` table. All the data in the column will be lost.
  - Added the required column `criadorId` to the `Conferencia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titulo` to the `Conferencia` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatusConferencia" AS ENUM ('EM_ANDAMENTO', 'FINALIZADA');

-- AlterTable
ALTER TABLE "Conferencia" DROP COLUMN "dataConferencia",
DROP COLUMN "usuario",
ADD COLUMN     "criadorId" TEXT NOT NULL,
ADD COLUMN     "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dataFinalizacao" TIMESTAMP(3),
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "status" "StatusConferencia" NOT NULL DEFAULT 'EM_ANDAMENTO',
ADD COLUMN     "titulo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ItemConferencia" ADD COLUMN     "usuarioId" TEXT;

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT NOT NULL,
    "cracha" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "foto" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conferenciaId" TEXT NOT NULL,

    CONSTRAINT "Participacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cracha_key" ON "Usuario"("cracha");

-- AddForeignKey
ALTER TABLE "Conferencia" ADD CONSTRAINT "Conferencia_criadorId_fkey" FOREIGN KEY ("criadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacao" ADD CONSTRAINT "Participacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacao" ADD CONSTRAINT "Participacao_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "Conferencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemConferencia" ADD CONSTRAINT "ItemConferencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
