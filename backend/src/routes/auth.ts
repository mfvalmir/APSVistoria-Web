import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getPool, sql } from "../db";

const router = Router();

// POST /auth/login
router.post("/login", async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ erro: "Informe usuário e senha" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("usuario", sql.VarChar, usuario)
      .query("SELECT id, nome, senha_hash FROM usuarios WHERE usuario = @usuario");

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos" });
    }

    const senhaOk = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaOk) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos" });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao autenticar" });
  }
});

export default router;
