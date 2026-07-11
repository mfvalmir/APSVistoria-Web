import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// Deriva uma rota amigável a partir do nome do formulário legado
// (ex: "frmContaPagar" -> "conta-pagar").
function paraRota(nomeFormulario: string): string {
  const semPrefixo = nomeFormulario.replace(/^frm/i, "");
  return semPrefixo.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

// GET /menu - árvore de navegação (Grupo -> Itens) com base nas permissões do usuário logado.
// Administrador ('Administrador'='S') enxerga todas as telas ativas; os demais
// só veem o que estiver liberado (AcessoFormulario=1) no perfil vinculado a ele em Permissoes/PermissoesItens.
//
// "Cadastro de Perfil de Usuários" (frmCadPermissoes) fica de fora do menu de propósito:
// já é acessível como ação (ícone de escudo) dentro da listagem de Cadastro de Usuários.
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const pool = await getPool();

    const query = req.user!.administrador
      ? `SELECT FormularioID, NomeFormulario, Descricao, Grupo, Ordem, Icone,
                CAST(1 AS BIT) AS PodeAdicionar, CAST(1 AS BIT) AS PodeEditar,
                CAST(1 AS BIT) AS PodeExcluir, CAST(1 AS BIT) AS PodeImprimir
         FROM Formularios
         WHERE Ativo = 'A'
           AND NomeFormulario <> 'frmCadPermissoes'
         ORDER BY Grupo, Ordem, Descricao`
      : `SELECT f.FormularioID, f.NomeFormulario, f.Descricao, f.Grupo, f.Ordem, f.Icone,
                pi.PodeAdicionar, pi.PodeEditar, pi.PodeExcluir, pi.PodeImprimir
         FROM Permissoes p
         JOIN PermissoesItens pi ON pi.PermissaoID = p.PermissaoID
         JOIN Formularios f ON f.FormularioID = pi.FormularioID
         WHERE p.UsuarioID = @usuarioId
           AND pi.AcessoFormulario = 1
           AND f.Ativo = 'A'
           AND f.NomeFormulario <> 'frmCadPermissoes'
         ORDER BY f.Grupo, f.Ordem, f.Descricao`;

    const result = await pool.request().input("usuarioId", sql.Int, req.user!.id).query(query);

    const grupos = new Map<string, any[]>();
    for (const row of result.recordset) {
      const grupo = row.Grupo || "Outros";
      if (!grupos.has(grupo)) grupos.set(grupo, []);
      grupos.get(grupo)!.push({
        id: row.FormularioID,
        nome: row.Descricao || row.NomeFormulario,
        icone: row.Icone,
        rota: paraRota(row.NomeFormulario),
        permissoes: {
          adicionar: row.PodeAdicionar,
          editar: row.PodeEditar,
          excluir: row.PodeExcluir,
          imprimir: row.PodeImprimir,
        },
      });
    }

    const arvore = Array.from(grupos.entries()).map(([grupo, itens]) => ({ grupo, itens }));
    res.json(arvore);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao carregar menu" });
  }
});

export default router;
