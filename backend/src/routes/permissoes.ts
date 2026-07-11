import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const CAMPOS_PERMITIDOS = [
  "acessoFormulario",
  "podeAdicionar",
  "podeEditar",
  "podeExcluir",
  "podeImprimir",
  "podeBaixarParCP",
  "podeEstornarParCP",
  "podeBaixarParCR",
  "podeEstornarParCR",
] as const;
type CampoPermitido = (typeof CAMPOS_PERMITIDOS)[number];

const COLUNA_POR_CAMPO: Record<CampoPermitido, string> = {
  acessoFormulario: "AcessoFormulario",
  podeAdicionar: "PodeAdicionar",
  podeEditar: "PodeEditar",
  podeExcluir: "PodeExcluir",
  podeImprimir: "PodeImprimir",
  podeBaixarParCP: "PodeBaixarParCP",
  podeEstornarParCP: "PodeEstornarParCP",
  podeBaixarParCR: "PodeBaixarParCR",
  podeEstornarParCR: "PodeEstornarParCR",
};

// GET /usuarios/:id/permissoes - árvore de aplicações disponíveis x repassadas
router.get("/:id/permissoes", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;

    const usuarioResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        `SELECT u.IDUser, u.Loginn, f.NomeFuncionario
         FROM usuario u
         LEFT JOIN Funcionario f ON f.IdFuncionario = u.IDFuncionario
         WHERE u.IDUser = @id`
      );
    const usuario = usuarioResult.recordset[0];
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

    const disponiveisResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        `SELECT f.FormularioID, f.Descricao, f.Grupo
         FROM Formularios f
         WHERE f.Ativo = 'A'
           AND NOT EXISTS (
             SELECT 1 FROM Permissoes p
             JOIN PermissoesItens pi ON pi.PermissaoID = p.PermissaoID
             WHERE p.UsuarioID = @id AND pi.FormularioID = f.FormularioID
           )
         ORDER BY f.Grupo, f.Ordem`
      );

    const repassadasResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        `SELECT f.FormularioID, f.Descricao, f.Grupo,
                pi.AcessoFormulario, pi.PodeAdicionar, pi.PodeEditar, pi.PodeExcluir, pi.PodeImprimir,
                pi.PodeBaixarParCP, pi.PodeEstornarParCP, pi.PodeBaixarParCR, pi.PodeEstornarParCR
         FROM Permissoes p
         JOIN PermissoesItens pi ON pi.PermissaoID = p.PermissaoID
         JOIN Formularios f ON f.FormularioID = pi.FormularioID
         WHERE p.UsuarioID = @id
         ORDER BY f.Grupo, f.Ordem`
      );

    res.json({
      usuario: {
        idUser: usuario.IDUser,
        login: usuario.Loginn,
        nomeFuncionario: usuario.NomeFuncionario,
      },
      disponiveis: disponiveisResult.recordset.map((r) => ({
        formularioId: r.FormularioID,
        descricao: r.Descricao,
        grupo: r.Grupo,
      })),
      repassadas: repassadasResult.recordset.map((r) => ({
        formularioId: r.FormularioID,
        descricao: r.Descricao,
        grupo: r.Grupo,
        acessoFormulario: r.AcessoFormulario,
        podeAdicionar: r.PodeAdicionar,
        podeEditar: r.PodeEditar,
        podeExcluir: r.PodeExcluir,
        podeImprimir: r.PodeImprimir,
        podeBaixarParCP: r.PodeBaixarParCP,
        podeEstornarParCP: r.PodeEstornarParCP,
        podeBaixarParCR: r.PodeBaixarParCR,
        podeEstornarParCR: r.PodeEstornarParCR,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar permissões" });
  }
});

// POST /usuarios/:id/permissoes - concede acesso a uma ou mais aplicações
router.post("/:id/permissoes", authMiddleware, async (req, res) => {
  const { formularioIds } = req.body as { formularioIds: number[] };
  if (!Array.isArray(formularioIds) || formularioIds.length === 0) {
    return res.status(400).json({ erro: "formularioIds é obrigatório" });
  }

  try {
    const pool = await getPool();
    const id = req.params.id;

    let permissaoResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT PermissaoID FROM Permissoes WHERE UsuarioID = @id");

    let permissaoId: number;
    if (permissaoResult.recordset.length > 0) {
      permissaoId = permissaoResult.recordset[0].PermissaoID;
    } else {
      // PermissaoID não é IDENTITY neste banco (padrão legado) - geramos manualmente.
      const inserted = await pool
        .request()
        .input("id", sql.Int, id)
        .query(
          `INSERT INTO Permissoes (PermissaoID, UsuarioID)
           OUTPUT INSERTED.PermissaoID
           VALUES ((SELECT ISNULL(MAX(PermissaoID), 0) + 1 FROM Permissoes), @id)`
        );
      permissaoId = inserted.recordset[0].PermissaoID;
    }

    // ItemID também não é IDENTITY - inserimos um de cada vez para gerar o próximo ID com segurança.
    for (const formularioId of formularioIds) {
      await pool
        .request()
        .input("permissaoId", sql.Int, permissaoId)
        .input("formularioId", sql.Int, formularioId)
        .query(
          `INSERT INTO PermissoesItens
             (ItemID, PermissaoID, FormularioID, AcessoFormulario, PodeAdicionar, PodeEditar, PodeExcluir, PodeImprimir,
              PodeBaixarParCP, PodeEstornarParCP, PodeBaixarParCR, PodeEstornarParCR)
           VALUES
             ((SELECT ISNULL(MAX(ItemID), 0) + 1 FROM PermissoesItens), @permissaoId, @formularioId, 1, 0, 0, 0, 0, 0, 0, 0, 0)`
        );
    }

    res.status(201).json({ mensagem: "Permissões concedidas" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao conceder permissões" });
  }
});

// DELETE /usuarios/:id/permissoes/:formularioId - revoga acesso a uma aplicação
router.delete("/:id/permissoes/:formularioId", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("formularioId", sql.Int, req.params.formularioId)
      .query(
        `DELETE pi FROM PermissoesItens pi
         JOIN Permissoes p ON p.PermissaoID = pi.PermissaoID
         WHERE p.UsuarioID = @id AND pi.FormularioID = @formularioId`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Permissão não encontrada" });
    }
    res.json({ mensagem: "Permissão removida" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao remover permissão" });
  }
});

// PATCH /usuarios/:id/permissoes/:formularioId - alterna um flag (podeAdicionar/podeEditar/podeExcluir)
router.patch("/:id/permissoes/:formularioId", authMiddleware, async (req, res) => {
  const { campo, valor } = req.body as { campo: string; valor: boolean };

  if (!CAMPOS_PERMITIDOS.includes(campo as CampoPermitido)) {
    return res.status(400).json({ erro: "campo inválido" });
  }

  try {
    const pool = await getPool();
    const coluna = COLUNA_POR_CAMPO[campo as CampoPermitido];

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("formularioId", sql.Int, req.params.formularioId)
      .input("valor", sql.Bit, !!valor)
      .query(
        `UPDATE pi SET pi.${coluna} = @valor
         FROM PermissoesItens pi
         JOIN Permissoes p ON p.PermissaoID = pi.PermissaoID
         WHERE p.UsuarioID = @id AND pi.FormularioID = @formularioId`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ erro: "Permissão não encontrada" });
    }
    res.json({ mensagem: "Permissão atualizada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar permissão" });
  }
});

export default router;
