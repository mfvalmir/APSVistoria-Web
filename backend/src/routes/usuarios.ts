import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";
import { criptografar } from "../legacyCrypt";

const router = Router();

const SELECT_BASE = `
  SELECT u.IDUser, u.IDFuncionario, u.Loginn, u.Situacao, u.Administrador,
         f.NomeFuncionario, fu.descricao AS Funcao
  FROM usuario u
  LEFT JOIN Funcionario f ON f.IdFuncionario = u.IDFuncionario
  LEFT JOIN Funcao fu ON fu.idFuncao = f.idFuncao
`;

// GET /usuarios?busca=&status= - lista com filtros (sem expor a senha)
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const status = (req.query.status as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("(u.Loginn LIKE @busca OR f.NomeFuncionario LIKE @busca)");
    }
    if (status === "A" || status === "I") {
      request.input("status", sql.NChar, status);
      condicoes.push("LTRIM(RTRIM(u.Situacao)) = @status");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY u.IDUser DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar usuários" });
  }
});

// GET /usuarios/:id - um usuário (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE u.IDUser = @id`);

    const usuario = result.recordset[0];
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });
    res.json(usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar usuário" });
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

    const existente = await pool
      .request()
      .input("login", sql.VarChar, login)
      .query("SELECT IDUser FROM usuario WHERE Loginn = @login");
    if (existente.recordset.length > 0) {
      return res.status(409).json({ erro: "Já existe um usuário com esse login" });
    }

    const senhaCriptografada = criptografar(process.env.LEGACY_CRYPT_KEY as string, senha);

    // IDUser não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    await pool
      .request()
      .input("idFuncionario", sql.Int, idFuncionario)
      .input("login", sql.VarChar, login)
      .input("senha", sql.VarChar, senhaCriptografada)
      .input("administrador", sql.NChar, administrador ? "S" : "N")
      .query(
        `INSERT INTO usuario (IDUser, IDFuncionario, Loginn, Senha, Situacao, Administrador)
         VALUES ((SELECT ISNULL(MAX(IDUser), 0) + 1 FROM usuario), @idFuncionario, @login, @senha, 'A', @administrador)`
      );

    res.status(201).json({ mensagem: "Usuário criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar usuário" });
  }
});

// PUT /usuarios/:id - edita login/status/administrador (a senha é alterada por rota própria)
router.put("/:id", authMiddleware, async (req, res) => {
  const { login, status, administrador } = req.body;

  if (!login || !status) {
    return res.status(400).json({ erro: "login e status são obrigatórios" });
  }

  try {
    const pool = await getPool();

    const existente = await pool
      .request()
      .input("login", sql.VarChar, login)
      .input("id", sql.Int, req.params.id)
      .query("SELECT IDUser FROM usuario WHERE Loginn = @login AND IDUser <> @id");
    if (existente.recordset.length > 0) {
      return res.status(409).json({ erro: "Já existe um usuário com esse login" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("login", sql.VarChar, login)
      .input("status", sql.NChar, status)
      .input("administrador", sql.NChar, administrador ? "S" : "N")
      .query(
        `UPDATE usuario
         SET Loginn = @login, Situacao = @status, Administrador = @administrador
         WHERE IDUser = @id`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }
    res.json({ mensagem: "Usuário atualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar usuário" });
  }
});

// PUT /usuarios/:id/senha - altera a senha, exigindo confirmação da senha atual
router.put("/:id/senha", authMiddleware, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ erro: "senhaAtual e novaSenha são obrigatórios" });
  }

  try {
    const pool = await getPool();
    const key = process.env.LEGACY_CRYPT_KEY as string;

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT Senha FROM usuario WHERE IDUser = @id");

    const usuario = result.recordset[0];
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

    const senhaAtualCriptografada = criptografar(key, senhaAtual);
    if (senhaAtualCriptografada !== usuario.Senha.trim().toLowerCase()) {
      return res.status(400).json({ erro: "Senha atual incorreta" });
    }

    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("senha", sql.VarChar, criptografar(key, novaSenha))
      .query("UPDATE usuario SET Senha = @senha WHERE IDUser = @id");

    res.json({ mensagem: "Senha alterada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao alterar senha" });
  }
});

// DELETE /usuarios/:id - desativa (soft delete), preserva permissões/histórico
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE usuario SET Situacao = 'I' WHERE IDUser = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }
    res.json({ mensagem: "Usuário desativado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao desativar usuário" });
  }
});

export default router;
