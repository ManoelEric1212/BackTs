import { Request, Router } from "express";
import prisma from "../prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Usuario } from "@prisma/client";

const router = Router();

router.post("/", async (req, res) => {
  const { email, senha, nome, sobrenome, cracha, cargo, foto } = req.body;

  const hash = await bcrypt.hash(senha, 10);

  try {
    const usuario = await prisma.usuario.create({
      data: { email, senha: hash, nome, sobrenome, cracha, cargo, foto },
    });
    res.json({ id: usuario.id, email: usuario.email, nome: usuario.nome });
  } catch (error) {
    res.status(400).json({ error: "Erro ao criar usuário" });
  }
});

router.get("/", async (req, res) => {
  try {
    const usuarios: Pick<
      Usuario,
      "id" | "nome" | "sobrenome" | "email" | "cracha" | "foto" | "criadoEm"
    >[] = await prisma.usuario.findMany({
      select: {
        id: true,
        nome: true,
        sobrenome: true,
        email: true,
        cracha: true,
        foto: true,
        criadoEm: true,
      },
      orderBy: { nome: "asc" },
    });

    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

router.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario)
    return res.status(404).json({ error: "Usuário não encontrado" });

  const valido = await bcrypt.compare(senha, usuario.senha);
  if (!valido) return res.status(401).json({ error: "Senha incorreta" });

  const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET!, {
    expiresIn: "8h",
  });
  res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      cargo: usuario.cargo,
      matricula: usuario.cracha,
      foto: usuario.foto,
    },
  });
});

export default router;
