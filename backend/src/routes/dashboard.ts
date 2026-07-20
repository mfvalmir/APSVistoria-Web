import { Router } from "express";
import { getPool, sql } from "../db";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// 0 = Pendente, 1 = Pago, 2 = Parcial, 3 = Cancelado (mesma convenção em ContaPagar/ContaReceber).
const STATUS_EM_ABERTO = "(0, 2)";

function paraISODate(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function ultimosNDias(n: number): string[] {
  const dias: string[] = [];
  const hoje = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    dias.push(paraISODate(d));
  }
  return dias;
}

function ultimosNMeses(n: number): { ano: number; mes: number; rotulo: string }[] {
  const meses: { ano: number; mes: number; rotulo: string }[] = [];
  const hoje = new Date();
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({ ano: d.getFullYear(), mes: d.getMonth() + 1, rotulo: nomes[d.getMonth()] });
  }
  return meses;
}

// GET /dashboard - agregados para a página Início (Caixa, Contas a Pagar/Receber, Vistoria)
router.get("/", authMiddleware, async (_req, res) => {
  try {
    const pool = await getPool();

    const [
      caixaResult,
      aReceberResult,
      aPagarResult,
      vistoriasMesResult,
      vencidasPagarResult,
      vencidasReceberResult,
      proximosVencimentosResult,
      fluxoCaixaResult,
      vistoriasPorMesResult,
      tiposPagamentoResult,
    ] = await Promise.all([
      pool
        .request()
        .query(
          `SELECT TOP 1 idCaixa, DataAbertura, SaldoInicial
           FROM Caixa WHERE DataFechamento IS NULL AND SaldoFinal IS NULL
           ORDER BY DataAbertura DESC`
        ),
      pool.request().query(`SELECT ISNULL(SUM(SaldoDevedor), 0) AS total FROM ContaReceber WHERE IdStatusContaReceber IN ${STATUS_EM_ABERTO}`),
      pool.request().query(`SELECT ISNULL(SUM(SaldoDevedor), 0) AS total FROM ContaPagar WHERE IdStatusContaPagar IN ${STATUS_EM_ABERTO}`),
      pool
        .request()
        .query(
          `SELECT COUNT(*) AS quantidade, ISNULL(SUM(ValorTotalServico), 0) AS faturamento
           FROM Vistoria
           WHERE YEAR(DataEmissao) = YEAR(GETDATE()) AND MONTH(DataEmissao) = MONTH(GETDATE())`
        ),
      pool
        .request()
        .query(
          `SELECT
             SUM(CASE WHEN DataVencimento < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS vencidasQtd,
             SUM(CASE WHEN DataVencimento < CAST(GETDATE() AS DATE) THEN ValorParcela ELSE 0 END) AS vencidasValor,
             SUM(CASE WHEN DataVencimento BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, 7, CAST(GETDATE() AS DATE)) THEN 1 ELSE 0 END) AS vencendoQtd,
             SUM(CASE WHEN DataVencimento BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, 7, CAST(GETDATE() AS DATE)) THEN ValorParcela ELSE 0 END) AS vencendoValor
           FROM ContaPagarParcela WHERE IdStatusParcela = 0`
        ),
      pool
        .request()
        .query(
          `SELECT
             SUM(CASE WHEN DataVencimento < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS vencidasQtd,
             SUM(CASE WHEN DataVencimento < CAST(GETDATE() AS DATE) THEN ValorParcela ELSE 0 END) AS vencidasValor,
             SUM(CASE WHEN DataVencimento BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, 7, CAST(GETDATE() AS DATE)) THEN 1 ELSE 0 END) AS vencendoQtd,
             SUM(CASE WHEN DataVencimento BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, 7, CAST(GETDATE() AS DATE)) THEN ValorParcela ELSE 0 END) AS vencendoValor
           FROM ContaReceberParcela WHERE IdStatusParcela = 0`
        ),
      pool.request().query(
        `SELECT TOP 8 * FROM (
           SELECT 'pagar' AS tipo, cp.idContaPagar AS idConta, p.IdContaPagarParcela AS idParcela,
                  cp.Descricao AS descricao, f.RazaoSocial AS contraparte, p.DataVencimento AS dataVencimento, p.ValorParcela AS valor
           FROM ContaPagarParcela p
           JOIN ContaPagar cp ON cp.idContaPagar = p.IdContaPagar
           LEFT JOIN Fornecedor f ON f.idFornecedor = cp.idFornecedor
           WHERE p.IdStatusParcela = 0

           UNION ALL

           SELECT 'receber' AS tipo, cr.IdContaReceber AS idConta, p.IdContaReceberParcela AS idParcela,
                  cr.Descricao AS descricao, c.NomeCliente AS contraparte, p.DataVencimento AS dataVencimento, p.ValorParcela AS valor
           FROM ContaReceberParcela p
           JOIN ContaReceber cr ON cr.IdContaReceber = p.IdContaReceber
           LEFT JOIN Cliente c ON c.idCliente = cr.idCliente
           WHERE p.IdStatusParcela = 0
         ) t
         ORDER BY dataVencimento ASC`
      ),
      pool
        .request()
        .query(
          `SELECT CAST(DataHora AS DATE) AS dia,
                  SUM(CASE WHEN TipoMovimento = 'E' THEN Valor ELSE 0 END) AS entrada,
                  SUM(CASE WHEN TipoMovimento = 'S' THEN Valor ELSE 0 END) AS saida
           FROM CaixaMovimento
           WHERE DataHora >= DATEADD(DAY, -29, CAST(GETDATE() AS DATE))
           GROUP BY CAST(DataHora AS DATE)`
        ),
      pool
        .request()
        .query(
          `SELECT YEAR(DataEmissao) AS ano, MONTH(DataEmissao) AS mes,
                  COUNT(*) AS quantidade, ISNULL(SUM(ValorTotalServico), 0) AS faturamento
           FROM Vistoria
           WHERE DataEmissao >= DATEADD(MONTH, -5, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
           GROUP BY YEAR(DataEmissao), MONTH(DataEmissao)`
        ),
      pool
        .request()
        .query(
          `SELECT tp.TipoPagamento AS tipo, COUNT(*) AS quantidade, SUM(m.Valor) AS valor
           FROM CaixaMovimento m
           JOIN TipoPagamento tp ON tp.idTipoPagamento = m.idFormaPagamento
           WHERE YEAR(m.DataHora) = YEAR(GETDATE()) AND MONTH(m.DataHora) = MONTH(GETDATE())
           GROUP BY tp.TipoPagamento
           ORDER BY SUM(m.Valor) DESC`
        ),
    ]);

    const caixa = caixaResult.recordset[0];
    let saldoAtual: number | null = null;
    if (caixa) {
      const saldoResult = await pool
        .request()
        .input("idCaixa", sql.Int, caixa.idCaixa)
        .query(
          `SELECT ISNULL(SUM(CASE WHEN TipoMovimento = 'E' THEN Valor ELSE -Valor END), 0) AS movimentado
           FROM CaixaMovimento WHERE idCaixa = @idCaixa`
        );
      saldoAtual = Number(caixa.SaldoInicial) + Number(saldoResult.recordset[0].movimentado);
    }

    const vPagar = vencidasPagarResult.recordset[0];
    const vReceber = vencidasReceberResult.recordset[0];

    const fluxoPorDia = new Map<string, { entrada: number; saida: number }>();
    for (const row of fluxoCaixaResult.recordset) {
      fluxoPorDia.set(paraISODate(new Date(row.dia)), { entrada: Number(row.entrada), saida: Number(row.saida) });
    }
    const fluxoCaixa = ultimosNDias(30).map((dia) => ({
      dia,
      ...(fluxoPorDia.get(dia) || { entrada: 0, saida: 0 }),
    }));

    const vistoriasPorMesMap = new Map<string, { quantidade: number; faturamento: number }>();
    for (const row of vistoriasPorMesResult.recordset) {
      vistoriasPorMesMap.set(`${row.ano}-${row.mes}`, { quantidade: row.quantidade, faturamento: Number(row.faturamento) });
    }
    const vistoriasPorMes = ultimosNMeses(6).map(({ ano, mes, rotulo }) => ({
      rotulo,
      ...(vistoriasPorMesMap.get(`${ano}-${mes}`) || { quantidade: 0, faturamento: 0 }),
    }));

    res.json({
      caixa: {
        aberto: !!caixa,
        saldoAtual,
        dataAbertura: caixa ? caixa.DataAbertura : null,
      },
      aReceberAberto: Number(aReceberResult.recordset[0].total),
      aPagarAberto: Number(aPagarResult.recordset[0].total),
      vistoriasMes: {
        quantidade: vistoriasMesResult.recordset[0].quantidade,
        faturamento: Number(vistoriasMesResult.recordset[0].faturamento),
      },
      alertas: {
        vencidas: {
          quantidade: (vPagar.vencidasQtd || 0) + (vReceber.vencidasQtd || 0),
          valor: Number(vPagar.vencidasValor || 0) + Number(vReceber.vencidasValor || 0),
        },
        vencendoEm7Dias: {
          quantidade: (vPagar.vencendoQtd || 0) + (vReceber.vencendoQtd || 0),
          valor: Number(vPagar.vencendoValor || 0) + Number(vReceber.vencendoValor || 0),
        },
        proximosVencimentos: proximosVencimentosResult.recordset.map((r) => ({
          tipo: r.tipo,
          idConta: r.idConta,
          idParcela: r.idParcela,
          descricao: r.descricao,
          contraparte: r.contraparte,
          dataVencimento: r.dataVencimento,
          valor: Number(r.valor),
        })),
      },
      fluxoCaixa,
      vistoriasPorMes,
      tiposPagamento: tiposPagamentoResult.recordset.map((r) => ({
        tipo: r.tipo,
        quantidade: r.quantidade,
        valor: Number(r.valor),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao carregar dashboard" });
  }
});

export default router;
