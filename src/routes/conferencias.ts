import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { Conferencia } from "@prisma/client";
import nodemailer from "nodemailer";

const router = Router();

interface ItemVerificado {
  codBem: string;
  localVerificado: string;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { titulo, ambiente, descricao, criadorId } = req.body as {
      titulo: string;
      ambiente: string;
      descricao?: string;
      criadorId: string;
    };

    const conferencia: Conferencia = await prisma.conferencia.create({
      data: { titulo, ambiente, descricao, criadorId },
    });

    res.json(conferencia);
  } catch (error) {
    res.status(400).json({ error: "Erro ao criar conferência" });
  }
});

router.post(
  "/:id/adicionar-participante",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email, cracha } = req.body as { email?: string; cracha?: string };

      const usuario = await prisma.usuario.findFirst({
        where: { OR: [{ email }, { cracha }] },
      });

      if (!usuario)
        return res.status(404).json({ error: "Usuário não encontrado" });

      const participacao = await prisma.participacao.upsert({
        where: {
          usuarioId_conferenciaId: {
            usuarioId: usuario.id,
            conferenciaId: id,
          },
        },
        update: {},
        create: { usuarioId: usuario.id, conferenciaId: id },
      });

      res.json(participacao);
    } catch (error) {
      res.status(500).json({ error: "Erro ao adicionar participante" });
    }
  }
);

router.post("/:id/adicionar-item", async (req, res) => {
  const { id } = req.params;
  const { codBem, localVerificado, usuarioId } = req.body;

  const existente = await prisma.itemConferencia.findFirst({
    where: { conferenciaId: id, codBem, usuarioId },
  });
  if (existente)
    return res
      .status(400)
      .json({ error: "Item já conferido por este usuário" });

  const ativo = await prisma.relacaoAtivos.findUnique({ where: { codBem } });
  if (!ativo) return res.status(404).json({ error: "Bem não encontrado" });

  const pertence = ativo.local === localVerificado;

  const item = await prisma.itemConferencia.create({
    data: {
      codBem,
      localVerificado,
      pertence,
      localReal: pertence ? null : ativo.local,
      conferenciaId: id,
      usuarioId,
    },
  });

  res.json(item);
});

// Finalizar conferência
router.patch("/:id/finalizar", async (req, res) => {
  const { id } = req.params;

  const conferencia = await prisma.conferencia.update({
    where: { id },
    data: { status: "FINALIZADA", dataFinalizacao: new Date() },
    include: {
      itensConferidos: true,
      participantes: { include: { usuario: true } },
    },
  });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  const emails = conferencia.participantes.map((p) => p.usuario.email);

  const html = `<h2>Resumo da Conferência: ${conferencia.titulo}</h2>
    <p>Local: ${conferencia.ambiente}</p>
    <p>Participantes: ${conferencia.participantes
      .map((p) => p.usuario.nome)
      .join(", ")}</p>
    <p>Total de itens: ${conferencia.itensConferidos.length}</p>
    <ul>${conferencia.itensConferidos
      .map(
        (i) =>
          `<li>${i.codBem} - ${i.pertence ? "No local" : "Fora do local"}</li>`
      )
      .join("")}</ul>`;

  await transporter.sendMail({
    from: `"Sistema de Conferência" <${process.env.SMTP_USER}>`,
    to: emails.join(","),
    subject: `Resumo da Conferência ${conferencia.titulo}`,
    html,
  });

  res.json({
    message: "Conferência finalizada e relatório enviado",
    conferencia,
  });
});

router.get("/historico/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;
  const conferencias = await prisma.conferencia.findMany({
    where: {
      OR: [
        { criadorId: usuarioId },
        { participantes: { some: { usuarioId } } },
      ],
    },
    include: {
      itensConferidos: true,
      participantes: { include: { usuario: true } },
    },
  });
  res.json(conferencias);
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
