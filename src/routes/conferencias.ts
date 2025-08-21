import { Router, Request, Response } from "express";
import prisma from "../prisma";

const router = Router();

interface ItemVerificado {
  codBem: string;
  localVerificado: string;
}

router.post("/", async (req, res) => {
  const { titulo, ambiente, descricao, criadorId } = req.body;
  const conferencia = await prisma.conferencia.create({
    data: { titulo, ambiente, descricao, criadorId },
  });
  res.json(conferencia);
});

router.post("/verificar", async (req: Request, res: Response) => {
  const {
    codBem,
    localVerificado,
  }: { codBem: string; localVerificado: string } = req.body;

  const ativo = await prisma.relacaoAtivos.findUnique({ where: { codBem } });

  if (!ativo) {
    return res.status(404).json({ error: "Bem não encontrado." });
  }

  const pertence = ativo.local === localVerificado;

  res.json({
    ...ativo,
    localVerificado,
    pertence,
  });
});

router.post("/verificar/global", async (req: Request, res: Response) => {
  const { codBem }: { codBem: string } = req.body;

  const ativo = await prisma.relacaoAtivos.findUnique({ where: { codBem } });

  if (!ativo) {
    return res.status(404).json({ error: "Bem não encontrado." });
  }

  res.json(ativo);
});

router.post("/verificar/local", async (req: Request, res: Response) => {
  const { local, cods }: { local: string; cods: string[] } = req.body;

  if (!local || !Array.isArray(cods)) {
    return res
      .status(400)
      .json({ error: "Dados inválidos. Envie 'local' e um array de 'cods'." });
  }

  try {
    const bensNoLocal = await prisma.relacaoAtivos.findMany({
      where: { local },
    });

    const bensInformados = await prisma.relacaoAtivos.findMany({
      where: { codBem: { in: cods } },
    });

    const codsNoLocal = bensNoLocal.map((bem) => bem.codBem);
    const codsInformados = new Set(cods);

    const conferidos = bensNoLocal.filter((bem) =>
      codsInformados.has(bem.codBem)
    );

    const faltantes = bensNoLocal.filter(
      (bem) => !codsInformados.has(bem.codBem)
    );

    const deOutroLocal = bensInformados.filter((bem) => bem.local !== local);

    res.json({
      totalInformados: cods.length,
      totalCadastradosNoLocal: codsNoLocal.length,
      conferidos: conferidos.length,
      itensConferidos: conferidos.map((bem) => ({
        codBem: bem.codBem,
        descricao: bem.descricao,
      })),
      faltantes: faltantes.length,
      deOutroLocal: deOutroLocal.map((bem) => ({
        codBem: bem.codBem,
        descricao: bem.descricao,
        localCadastrado: bem.local,
      })),
      itensFaltantes: faltantes.map((bem) => ({
        codBem: bem.codBem,
        descricao: bem.descricao,
      })),
    });
  } catch (error) {
    console.error("Erro ao verificar itens:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
