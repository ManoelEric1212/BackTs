-- CreateTable
CREATE TABLE "RelacaoAtivos" (
    "codBem" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "modeloProd" TEXT NOT NULL,
    "fabricaProd" TEXT NOT NULL,
    "dataAquisicao" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "local" TEXT NOT NULL,
    "valorCompra" TEXT NOT NULL,
    "valorResidual" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,

    CONSTRAINT "RelacaoAtivos_pkey" PRIMARY KEY ("codBem")
);

-- CreateTable
CREATE TABLE "Conferencia" (
    "id" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "dataConferencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemConferencia" (
    "id" TEXT NOT NULL,
    "codBem" TEXT NOT NULL,
    "localVerificado" TEXT NOT NULL,
    "pertence" BOOLEAN NOT NULL,
    "localReal" TEXT,
    "conferenciaId" TEXT NOT NULL,

    CONSTRAINT "ItemConferencia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ItemConferencia" ADD CONSTRAINT "ItemConferencia_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "Conferencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemConferencia" ADD CONSTRAINT "ItemConferencia_codBem_fkey" FOREIGN KEY ("codBem") REFERENCES "RelacaoAtivos"("codBem") ON DELETE RESTRICT ON UPDATE CASCADE;
