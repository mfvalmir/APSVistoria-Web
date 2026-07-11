import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SELECT_BASE = `
  SELECT f.FormularioID, f.NomeFormulario, f.Descricao, f.Ativo, f.Grupo, f.Ordem, f.Icone
  FROM Formularios f
`;

// GET /formularios/grupos - grupos já usados (pra sugestão no form, não é tabela de lookup formal)
router.get("/grupos", authMiddleware, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT DISTINCT Grupo FROM Formularios WHERE Grupo IS NOT NULL ORDER BY Grupo");
    res.json(result.recordset.map((r) => r.Grupo));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar grupos" });
  }
});

// GET /formularios?busca=&status= - lista com filtros
router.get("/", authMiddleware, async (req, res) => {
  const busca = (req.query.busca as string | undefined)?.trim();
  const status = (req.query.status as string | undefined)?.trim();

  try {
    const pool = await getPool();
    const request = pool.request();

    const condicoes: string[] = [];
    if (busca) {
      request.input("busca", sql.VarChar, `%${busca}%`);
      condicoes.push("(f.NomeFormulario LIKE @busca OR f.Descricao LIKE @busca)");
    }
    if (status === "A" || status === "I") {
      request.input("status", sql.NChar, status);
      condicoes.push("LTRIM(RTRIM(f.Ativo)) = @status");
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const result = await request.query(`${SELECT_BASE} ${where} ORDER BY f.Grupo, f.Ordem, f.Descricao`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar formulários" });
  }
});

// GET /formularios/:id - um formulário (para edição)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`${SELECT_BASE} WHERE f.FormularioID = @id`);

    const formulario = result.recordset[0];
    if (!formulario) return res.status(404).json({ erro: "Formulário não encontrado" });
    res.json(formulario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar formulário" });
  }
});

// POST /formularios - cria um novo formulário
router.post("/", authMiddleware, async (req, res) => {
  const { nomeFormulario, descricao, grupo, ordem, icone } = req.body;

  if (!nomeFormulario) {
    return res.status(400).json({ erro: "nomeFormulario é obrigatório" });
  }

  try {
    const pool = await getPool();

    const existente = await pool
      .request()
      .input("nomeFormulario", sql.VarChar, nomeFormulario)
      .query("SELECT FormularioID FROM Formularios WHERE NomeFormulario = @nomeFormulario");
    if (existente.recordset.length > 0) {
      return res.status(409).json({ erro: "Já existe um formulário com esse nome" });
    }

    // FormularioID não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    await pool
      .request()
      .input("nomeFormulario", sql.VarChar, nomeFormulario)
      .input("descricao", sql.VarChar, descricao || null)
      .input("grupo", sql.VarChar, grupo || null)
      .input("ordem", sql.Int, ordem || null)
      .input("icone", sql.VarChar, icone || null)
      .query(
        `INSERT INTO Formularios (FormularioID, NomeFormulario, Descricao, Ativo, Grupo, Ordem, Icone)
         VALUES ((SELECT ISNULL(MAX(FormularioID), 0) + 1 FROM Formularios), @nomeFormulario, @descricao, 'A', @grupo, @ordem, @icone)`
      );

    res.status(201).json({ mensagem: "Formulário criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar formulário" });
  }
});

// PUT /formularios/:id - edita um formulário
router.put("/:id", authMiddleware, async (req, res) => {
  const { nomeFormulario, descricao, grupo, ordem, icone, ativo } = req.body;

  if (!nomeFormulario || !ativo) {
    return res.status(400).json({ erro: "nomeFormulario e ativo são obrigatórios" });
  }

  try {
    const pool = await getPool();

    const existente = await pool
      .request()
      .input("nomeFormulario", sql.VarChar, nomeFormulario)
      .input("id", sql.Int, req.params.id)
      .query("SELECT FormularioID FROM Formularios WHERE NomeFormulario = @nomeFormulario AND FormularioID <> @id");
    if (existente.recordset.length > 0) {
      return res.status(409).json({ erro: "Já existe um formulário com esse nome" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("nomeFormulario", sql.VarChar, nomeFormulario)
      .input("descricao", sql.VarChar, descricao || null)
      .input("grupo", sql.VarChar, grupo || null)
      .input("ordem", sql.Int, ordem || null)
      .input("icone", sql.VarChar, icone || null)
      .input("ativo", sql.NChar, ativo)
      .query(
        `UPDATE Formularios
         SET NomeFormulario = @nomeFormulario, Descricao = @descricao, Grupo = @grupo,
             Ordem = @ordem, Icone = @icone, Ativo = @ativo
         WHERE FormularioID = @id`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Formulário não encontrado" });
    }
    res.json({ mensagem: "Formulário atualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar formulário" });
  }
});

// DELETE /formularios/:id - desativa (soft delete), some do menu (AcessoFormulario/Ativo)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE Formularios SET Ativo = 'I' WHERE FormularioID = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Formulário não encontrado" });
    }
    res.json({ mensagem: "Formulário desativado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao desativar formulário" });
  }
});

export default router;
