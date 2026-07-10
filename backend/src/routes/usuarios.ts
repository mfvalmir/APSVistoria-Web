import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";
import { criptografar } from "../legacyCrypt";

const router = Router();

// GET /usuarios - lista todos (sem expor a senha)
router.get("/", authMiddleware, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT u.IDUser, u.IDFuncionario, u.Loginn, u.Situacao, u.Administrador,
              f.NomeFuncionario
       FROM usuario u
       LEFT JOIN Funcionario f ON f.IdFuncionario = u.IDFuncionario`
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar usuários" });
  }
});

// POST /usuarios - cria um novo, vinculado a um Funcionario existente
router.post("/", authMiddleware, async (req, res) => {
  const { idFuncionario, login, senha, administrador } = req.body;

  if (!idFuncionario || !login || !senha) {
    return res.status(400).json({ erro: "idFuncionario, login e senha são obrigatórios" });
  }

  try {
    const pool = await getPool();
    const senhaCriptografada = criptografar(process.env.LEGACY_CRYPT_KEY as string, senha);

    await pool
      .request()
      .input("idFuncionario", sql.Int, idFuncionario)
      .input("login", sql.VarChar, login)
      .input("senha", sql.VarChar, senhaCriptografada)
      .input("administrador", sql.NChar, administrador ? "S" : "N")
      .query(
        `INSERT INTO usuario (IDFuncionario, Loginn, Senha, Situacao, Administrador)
         VALUES (@idFuncionario, @login, @senha, 'A', @administrador)`
      );

    res.status(201).json({ mensagem: "Usuário criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar usuário" });
  }
});

export default router;
