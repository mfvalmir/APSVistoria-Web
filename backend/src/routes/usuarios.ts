import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// GET /usuarios - lista todos
// Troque "authMiddleware" para exigir login. Por enquanto (rede interna) fica livre.
router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT id, nome, usuario FROM usuarios");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar usuários" });
  }
});

// POST /usuarios - cria um novo
router.post("/", async (req, res) => {
  const { nome, usuario } = req.body;

  if (!nome || !usuario) {
    return res.status(400).json({ erro: "Nome e usuário são obrigatórios" });
  }

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("nome", sql.VarChar, nome)
      .input("usuario", sql.VarChar, usuario)
      .query("INSERT INTO usuarios (nome, usuario) VALUES (@nome, @usuario)");

    res.status(201).json({ mensagem: "Usuário criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar usuário" });
  }
});

// Exemplo de rota protegida (exige token JWT no header Authorization)
router.get("/protegido", authMiddleware, async (_req, res) => {
  res.json({ mensagem: "Você está autenticado!" });
});

export default router;
