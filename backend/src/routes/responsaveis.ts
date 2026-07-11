import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";
import { validarCPF } from "../utils/documento";

const router = Router();

const SELECT_BASE = `
  SELECT r.idResponsavel, r.idCliente, r.NomeResponsavel, r.DocResponsavel, r.CelularResponsavel
  FROM Responsavel r
`;

// GET /clientes/:clienteId/responsaveis - lista os responsáveis de um cliente
router.get("/:clienteId/responsaveis", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("clienteId", sql.Int, req.params.clienteId)
      .query(`${SELECT_BASE} WHERE r.idCliente = @clienteId ORDER BY r.idResponsavel DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar responsáveis" });
  }
});

// POST /clientes/:clienteId/responsaveis - cria um novo responsável para o cliente
router.post("/:clienteId/responsaveis", authMiddleware, async (req, res) => {
  const { nomeResponsavel, docResponsavel, celularResponsavel } = req.body;

  if (!nomeResponsavel) {
    return res.status(400).json({ erro: "nomeResponsavel é obrigatório" });
  }
  if (docResponsavel && !validarCPF(docResponsavel)) {
    return res.status(400).json({ erro: "CPF do responsável inválido" });
  }

  try {
    const pool = await getPool();

    const cliente = await pool
      .request()
      .input("clienteId", sql.Int, req.params.clienteId)
      .query("SELECT idCliente FROM Cliente WHERE idCliente = @clienteId");
    if (cliente.recordset.length === 0) {
      return res.status(404).json({ erro: "Cliente não encontrado" });
    }

    // idResponsavel não é IDENTITY neste banco (padrão legado) - geramos o próximo valor manualmente.
    await pool
      .request()
      .input("clienteId", sql.Int, req.params.clienteId)
      .input("nomeResponsavel", sql.VarChar, nomeResponsavel)
      .input("docResponsavel", sql.VarChar, docResponsavel ? docResponsavel.replace(/\D/g, "") : null)
      .input("celularResponsavel", sql.VarChar, celularResponsavel || null)
      .query(
        `INSERT INTO Responsavel (idResponsavel, idCliente, NomeResponsavel, DocResponsavel, CelularResponsavel)
         VALUES ((SELECT ISNULL(MAX(idResponsavel), 0) + 1 FROM Responsavel), @clienteId, @nomeResponsavel,
                 @docResponsavel, @celularResponsavel)`
      );

    res.status(201).json({ mensagem: "Responsável criado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar responsável" });
  }
});

// PUT /clientes/:clienteId/responsaveis/:id - edita um responsável
router.put("/:clienteId/responsaveis/:id", authMiddleware, async (req, res) => {
  const { nomeResponsavel, docResponsavel, celularResponsavel } = req.body;

  if (!nomeResponsavel) {
    return res.status(400).json({ erro: "nomeResponsavel é obrigatório" });
  }
  if (docResponsavel && !validarCPF(docResponsavel)) {
    return res.status(400).json({ erro: "CPF do responsável inválido" });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("clienteId", sql.Int, req.params.clienteId)
      .input("nomeResponsavel", sql.VarChar, nomeResponsavel)
      .input("docResponsavel", sql.VarChar, docResponsavel ? docResponsavel.replace(/\D/g, "") : null)
      .input("celularResponsavel", sql.VarChar, celularResponsavel || null)
      .query(
        `UPDATE Responsavel
         SET NomeResponsavel = @nomeResponsavel, DocResponsavel = @docResponsavel,
             CelularResponsavel = @celularResponsavel
         WHERE idResponsavel = @id AND idCliente = @clienteId`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Responsável não encontrado" });
    }
    res.json({ mensagem: "Responsável atualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar responsável" });
  }
});

// DELETE /clientes/:clienteId/responsaveis/:id - exclusão definitiva (tabela sem coluna de status).
// O banco legado não tem FK real entre Vistoria.idResponsavel e Responsavel.idResponsavel, então o
// vínculo é checado aqui na aplicação antes de excluir (ver [[project-exclusao-verifica-vinculo]]).
router.delete("/:clienteId/responsaveis/:id", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();

    const emUso = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT TOP 1 idVistoria FROM Vistoria WHERE idResponsavel = @id");
    if (emUso.recordset.length > 0) {
      return res
        .status(409)
        .json({ erro: "Não é possível excluir: existem vistorias vinculadas a este responsável" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("clienteId", sql.Int, req.params.clienteId)
      .query("DELETE FROM Responsavel WHERE idResponsavel = @id AND idCliente = @clienteId");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Responsável não encontrado" });
    }
    res.json({ mensagem: "Responsável excluído" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir responsável" });
  }
});

export default router;
