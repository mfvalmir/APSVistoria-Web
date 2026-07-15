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
//
// "DashboardWeb" também fica de fora da árvore: não é uma tela navegável, é só o formulário
// usado em Cadastro de Perfil de Usuários para liberar/bloquear o conteúdo da tela Início
// (painel com Caixa/Contas/Vistorias), que sempre existe como landing page (rota null).
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const pool = await getPool();

    const query = req.user!.administrador
      ? `SELECT FormularioID, NomeFormulario, Descricao, Grupo, Ordem, Icone,
                CAST(1 AS BIT) AS PodeAdicionar, CAST(1 AS BIT) AS PodeEditar,
                CAST(1 AS BIT) AS PodeExcluir, CAST(1 AS BIT) AS PodeImprimir,
                CAST(1 AS BIT) AS PodeBaixarParCP, CAST(1 AS BIT) AS PodeEstornarParCP,
                CAST(1 AS BIT) AS PodeBaixarParCR, CAST(1 AS BIT) AS PodeEstornarParCR
         FROM Formularios
         WHERE Ativo = 'A'
           AND NomeFormulario NOT IN ('frmCadPermissoes', 'DashboardWeb')
         ORDER BY Grupo, Ordem, Descricao`
      : `SELECT f.FormularioID, f.NomeFormulario, f.Descricao, f.Grupo, f.Ordem, f.Icone,
                pi.PodeAdicionar, pi.PodeEditar, pi.PodeExcluir, pi.PodeImprimir,
                pi.PodeBaixarParCP, pi.PodeEstornarParCP, pi.PodeBaixarParCR, pi.PodeEstornarParCR
         FROM Permissoes p
         JOIN PermissoesItens pi ON pi.PermissaoID = p.PermissaoID
         JOIN Formularios f ON f.FormularioID = pi.FormularioID
         WHERE p.UsuarioID = @usuarioId
           AND pi.AcessoFormulario = 1
           AND f.Ativo = 'A'
           AND f.NomeFormulario NOT IN ('frmCadPermissoes', 'DashboardWeb')
         ORDER BY f.Grupo, f.Ordem, f.Descricao`;

    const result = await pool.request().input("usuarioId", sql.Int, req.user!.id).query(query);

    let podeVerInicio = req.user!.administrador;
    if (!podeVerInicio) {
      const acessoInicio = await pool
        .request()
        .input("usuarioId", sql.Int, req.user!.id)
        .query(
          `SELECT TOP 1 pi.ItemID
           FROM Permissoes p
           JOIN PermissoesItens pi ON pi.PermissaoID = p.PermissaoID
           JOIN Formularios f ON f.FormularioID = pi.FormularioID
           WHERE p.UsuarioID = @usuarioId
             AND pi.AcessoFormulario = 1
             AND f.NomeFormulario = 'DashboardWeb'`
        );
      podeVerInicio = acessoInicio.recordset.length > 0;
    }

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
          baixarParCP: row.PodeBaixarParCP,
          estornarParCP: row.PodeEstornarParCP,
          baixarParCR: row.PodeBaixarParCR,
          estornarParCR: row.PodeEstornarParCR,
        },
      });
    }

    const arvore = Array.from(grupos.entries()).map(([grupo, itens]) => ({ grupo, itens }));
    res.json({ grupos: arvore, podeVerInicio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao carregar menu" });
  }
});

export default router;
