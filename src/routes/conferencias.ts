import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { Conferencia } from "@prisma/client";
import nodemailer from "nodemailer";

const router = Router();

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

router.get("/:id/participantes", async (req, res) => {
  const { id } = req.params;

  try {
    const conferencia = await prisma.conferencia.findUnique({
      where: { id },
      select: { criadorId: true },
    });

    if (!conferencia) {
      return res.status(404).json({ error: "Conferência não encontrada" });
    }

    const criador = await prisma.usuario.findUnique({
      where: { id: conferencia.criadorId },
      select: {
        id: true,
        nome: true,
        email: true,
        cracha: true,
        foto: true,
      },
    });
    const participantes = await prisma.participacao.findMany({
      where: { conferenciaId: id },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            cracha: true,
            foto: true,
          },
        },
      },
    });
    const usuarios = participantes.map((p) => ({
      ...p.usuario,
      criador: false,
    }));
    if (criador) {
      usuarios.unshift({ ...criador, criador: true });
    }

    res.json(usuarios);
  } catch (error) {
    console.error("Erro ao buscar participantes da conferência:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.post("/:id/adicionar-item", async (req, res) => {
  const { id } = req.params;
  const { codBem, localVerificado, usuarioId } = req.body;

  const existente = await prisma.itemConferencia.findFirst({
    where: { conferenciaId: id, codBem },
  });
  if (existente) return res.status(400).json({ error: "Item já conferido!" });

  const ativo = await prisma.relacaoAtivos.findUnique({ where: { codBem } });
  if (!ativo) return res.status(404).json({ error: "Bem não encontrado" });

  const pertence = ativo.local === localVerificado;

  const item = await prisma.itemConferencia.create({
    data: {
      codBem,
      localVerificado,
      pertence,
      localReal: ativo.local,
      conferenciaId: id,
      usuarioId,
    },
  });

  res.json(item);
});

router.get("/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conferencia = await prisma.conferencia.findUnique({
      where: { id },
      include: { itensConferidos: true },
    });
    if (!conferencia) {
      return res.status(404).json({ error: "Conferência não encontrada" });
    }
    const bensDoLocal = await prisma.relacaoAtivos.findMany({
      where: { local: conferencia.ambiente },
    });

    const codsVerificados = new Set(
      conferencia.itensConferidos.map((item) => item.codBem)
    );

    const bensVerificados = bensDoLocal.filter((bem) =>
      codsVerificados.has(bem.codBem)
    );

    const bensFaltantes = bensDoLocal.filter(
      (bem) => !codsVerificados.has(bem.codBem)
    );

    res.json({
      conferencia: {
        id: conferencia.id,
        titulo: conferencia.titulo,
        ambiente: conferencia.ambiente,
        status: conferencia.status,
      },
      totalBens: bensDoLocal.length,
      totalVerificados: bensVerificados.length,
      totalFaltantes: bensFaltantes.length,
      bensVerificados: bensVerificados.map((b) => ({
        codBem: b.codBem,
        descricao: b.descricao,
      })),
      bensFaltantes: bensFaltantes.map((b) => ({
        codBem: b.codBem,
        descricao: b.descricao,
      })),
    });
  } catch (error) {
    console.error("Erro ao obter status da conferência:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.get("/:id/finalizar", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const conferencia = await prisma.conferencia.update({
      where: { id },
      data: { status: "FINALIZADA", dataFinalizacao: new Date() },
      include: {
        itensConferidos: {
          include: { ativo: true },
        },
        participantes: { include: { usuario: true } },
      },
    });

    const bensDoLocal = await prisma.relacaoAtivos.findMany({
      where: { local: conferencia.ambiente },
    });

    const codsVerificados = new Set(
      conferencia.itensConferidos.map((item) => item.codBem)
    );

    const bensVerificados = bensDoLocal.filter((bem) =>
      codsVerificados.has(bem.codBem)
    );

    const bensFaltantes = bensDoLocal.filter(
      (bem) => !codsVerificados.has(bem.codBem)
    );

    // Itens conferidos que pertencem a outros ambientes (pertence = false)
    const itensFora = conferencia.itensConferidos.filter((i) => !i.pertence);

    // Agrupar por ambiente real (campo `localReal` do item ou `ativo.local`)
    const agrupadosPorAmbiente: Record<string, typeof itensFora> = {};
    itensFora.forEach((item) => {
      const ambienteNome =
        item.localReal || item.ativo?.local || "Não especificado";
      if (!agrupadosPorAmbiente[ambienteNome]) {
        agrupadosPorAmbiente[ambienteNome] = [];
      }
      agrupadosPorAmbiente[ambienteNome].push(item);
    });

    // Montar HTML do relatório
    const html = `
      <h2>Resumo da Conferência: ${conferencia.titulo}</h2>
      <p><strong>Local:</strong> ${conferencia.ambiente}</p>
      <p><strong>Status:</strong> ${conferencia.status}</p>
      <p><strong>Participantes:</strong> ${conferencia.participantes
        .map((p) => p.usuario.nome)
        .join(", ")}</p>

      <h3>Status dos bens</h3>
      <ul>
        <li>Total esperado: ${bensDoLocal.length}</li>
        <li>Total verificados: ${bensVerificados.length}</li>
        <li>Total faltantes: ${bensFaltantes.length}</li>
        <li>Total fora do local: ${itensFora.length}</li>
      </ul>

      <h3>Bens verificados</h3>
      <ul>
        ${bensVerificados
          .map((b) => `<li>${b.codBem} - ${b.descricao}</li>`)
          .join("")}
      </ul>

      <h3>Bens faltantes</h3>
      <ul>
        ${bensFaltantes
          .map((b) => `<li>${b.codBem} - ${b.descricao}</li>`)
          .join("")}
      </ul>

      <h3>Itens encontrados fora do local</h3>
      ${
        itensFora.length > 0
          ? Object.entries(agrupadosPorAmbiente)
              .map(
                ([ambiente, itens]) => `
              <h4>${ambiente} (${itens.length} item${
                  itens.length > 1 ? "s" : ""
                })</h4>
              <ul>
                ${itens
                  .map(
                    (i) =>
                      `<li>${i.codBem} - ${
                        i.ativo?.descricao || "Sem descrição"
                      }</li>`
                  )
                  .join("")}
              </ul>
            `
              )
              .join("")
          : "<p>Nenhum item encontrado fora do local.</p>"
      }
    `;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    const emails = conferencia.participantes.map((p) => p.usuario.email);

    await transporter.sendMail({
      from: `"Sistema de Conferência" <${process.env.SMTP_USER}>`,
      to: emails.join(","),
      subject: `Resumo da Conferência ${conferencia.titulo}`,
      html,
    });

    res.json({
      message: "Conferência finalizada e relatório enviado",
      conferencia: {
        id: conferencia.id,
        titulo: conferencia.titulo,
        ambiente: conferencia.ambiente,
        status: conferencia.status,
        totalBens: bensDoLocal.length,
        totalVerificados: bensVerificados.length,
        totalFaltantes: bensFaltantes.length,
        totalFora: itensFora.length,
        foraAgrupados: Object.fromEntries(
          Object.entries(agrupadosPorAmbiente).map(([amb, itens]) => [
            amb,
            itens.map((i) => ({
              codBem: i.codBem,
              descricao: i.ativo?.descricao || "",
            })),
          ])
        ),
      },
    });
  } catch (error) {
    console.error("Erro ao finalizar conferência:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
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
      itensConferidos: {
        include: {
          ativo: true,
        },
      },
      participantes: { include: { usuario: true } },
    },
  });
  res.json(conferencias);
});

router.get("/:id/detalhes", async (req, res) => {
  const { id } = req.params;

  try {
    const conferencia = await prisma.conferencia.findUnique({
      where: { id },
      include: {
        itensConferidos: {
          include: {
            ativo: true,
          },
        },
        participantes: { include: { usuario: true } },
      },
    });

    if (!conferencia) {
      return res.status(404).json({ error: "Conferência não encontrada" });
    }

    res.json(conferencia);
  } catch (error) {
    console.error("Erro ao buscar detalhes da conferência:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
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
