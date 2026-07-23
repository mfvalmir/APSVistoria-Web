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
      rankingVistoriadoresResult,
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
      pool
        .request()
        .query(
          `SELECT TOP 10 fv.IdFuncionario AS idVistoriador, fv.NomeFuncionario AS nome,
                  COUNT(*) AS quantidade, ISNULL(SUM(v.ValorTotalServico), 0) AS faturamento
           FROM Vistoria v
           JOIN Funcionario fv ON fv.IdFuncionario = v.idVistoriador
           WHERE YEAR(v.DataEmissao) = YEAR(GETDATE()) AND MONTH(v.DataEmissao) = MONTH(GETDATE())
           GROUP BY fv.IdFuncionario, fv.NomeFuncionario
           ORDER BY COUNT(*) DESC`
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
          pagar: {
            quantidade: vPagar.vencidasQtd || 0,
            valor: Number(vPagar.vencidasValor || 0),
          },
          receber: {
            quantidade: vReceber.vencidasQtd || 0,
            valor: Number(vReceber.vencidasValor || 0),
          },
        },
        vencendoEm7Dias: {
          pagar: {
            quantidade: vPagar.vencendoQtd || 0,
            valor: Number(vPagar.vencendoValor || 0),
          },
          receber: {
            quantidade: vReceber.vencendoQtd || 0,
            valor: Number(vReceber.vencendoValor || 0),
          },
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
      rankingVistoriadores: rankingVistoriadoresResult.recordset.map((r) => ({
        idVistoriador: r.idVistoriador,
        nome: r.nome,
        quantidade: r.quantidade,
        faturamento: Number(r.faturamento),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao carregar dashboard" });
  }
});

// GET /dashboard/vistoriadores-detalhado - lista (não agregada) das vistorias do mês atual,
// usada pelo botão de relatório do card de ranking para montar o PDF agrupado por vistoriador.
router.get("/vistoriadores-detalhado", authMiddleware, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT v.idVistoria, v.DataEmissao, v.PlacaVeiculo, v.ValorTotalServico,
              cli.NomeCliente, s.DescricaoServico,
              v.idVistoriador, fv.NomeFuncionario AS NomeVistoriador
       FROM Vistoria v
       LEFT JOIN Cliente cli ON cli.idCliente = v.idCliente
       LEFT JOIN Servico s ON s.idServico = v.idServico
       LEFT JOIN Funcionario fv ON fv.IdFuncionario = v.idVistoriador
       WHERE YEAR(v.DataEmissao) = YEAR(GETDATE()) AND MONTH(v.DataEmissao) = MONTH(GETDATE())
       ORDER BY fv.NomeFuncionario, v.DataEmissao`
    );
    res.json(
      result.recordset.map((r) => ({
        idVistoria: r.idVistoria,
        dataEmissao: r.DataEmissao,
        placaVeiculo: r.PlacaVeiculo,
        valorTotalServico: Number(r.ValorTotalServico),
        nomeCliente: r.NomeCliente,
        descricaoServico: r.DescricaoServico,
        idVistoriador: r.idVistoriador,
        nomeVistoriador: r.NomeVistoriador,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar detalhamento de vistorias por vistoriador" });
  }
});

function condicaoDataParcela(filtro: "vencidas" | "vencendo7dias"): string {
  return filtro === "vencidas"
    ? "p.DataVencimento < CAST(GETDATE() AS DATE)"
    : "p.DataVencimento BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, 7, CAST(GETDATE() AS DATE))";
}

function queryParcelasPagar(filtro: "vencidas" | "vencendo7dias"): string {
  return `SELECT p.IdContaPagarParcela AS IdParcela, p.IdContaPagar AS IdConta, p.NumeroParcela,
                 p.DataVencimento, p.ValorParcela,
                 DATEDIFF(DAY, p.DataVencimento, CAST(GETDATE() AS DATE)) AS DiasEmAtraso,
                 cp.Descricao AS DescricaoConta, f.RazaoSocial AS Contraparte
          FROM ContaPagarParcela p
          JOIN ContaPagar cp ON cp.idContaPagar = p.IdContaPagar
          LEFT JOIN Fornecedor f ON f.idFornecedor = cp.idFornecedor
          WHERE p.IdStatusParcela = 0 AND ${condicaoDataParcela(filtro)}
          ORDER BY p.DataVencimento ASC`;
}

function queryParcelasReceber(filtro: "vencidas" | "vencendo7dias"): string {
  return `SELECT p.IdContaReceberParcela AS IdParcela, p.IdContaReceber AS IdConta, p.NumeroParcela,
                 p.DataVencimento, p.ValorParcela,
                 DATEDIFF(DAY, p.DataVencimento, CAST(GETDATE() AS DATE)) AS DiasEmAtraso,
                 cr.Descricao AS DescricaoConta, c.NomeCliente AS Contraparte
          FROM ContaReceberParcela p
          JOIN ContaReceber cr ON cr.IdContaReceber = p.IdContaReceber
          LEFT JOIN Cliente c ON c.idCliente = cr.idCliente
          WHERE p.IdStatusParcela = 0 AND ${condicaoDataParcela(filtro)}
          ORDER BY p.DataVencimento ASC`;
}

function mapearParcelas(recordset: any[]) {
  return recordset.map((r) => ({
    idParcela: r.IdParcela,
    idConta: r.IdConta,
    numeroParcela: r.NumeroParcela,
    dataVencimento: r.DataVencimento,
    valorParcela: Number(r.ValorParcela),
    diasEmAtraso: r.DiasEmAtraso,
    descricaoConta: r.DescricaoConta,
    contraparte: r.Contraparte,
  }));
}

// GET /dashboard/parcelas-alertas-detalhado - lista (não agregada), em uma única resposta, as
// parcelas por trás dos 4 cards de alerta (Vencidas/Vencendo em 7 dias, Pagar/Receber). O botão
// único de relatório do dashboard usa isso para montar um único PDF, com uma seção por
// categoria que tiver parcela (categorias vazias são puladas na hora de montar o PDF).
router.get("/parcelas-alertas-detalhado", authMiddleware, async (_req, res) => {
  try {
    const pool = await getPool();
    const [pagarVencidas, receberVencidas, pagarVencendo, receberVencendo] = await Promise.all([
      pool.request().query(queryParcelasPagar("vencidas")),
      pool.request().query(queryParcelasReceber("vencidas")),
      pool.request().query(queryParcelasPagar("vencendo7dias")),
      pool.request().query(queryParcelasReceber("vencendo7dias")),
    ]);

    res.json({
      pagarVencidas: mapearParcelas(pagarVencidas.recordset),
      receberVencidas: mapearParcelas(receberVencidas.recordset),
      pagarVencendo7Dias: mapearParcelas(pagarVencendo.recordset),
      receberVencendo7Dias: mapearParcelas(receberVencendo.recordset),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar parcelas em aberto" });
  }
});

// GET /dashboard/contas-abertas-detalhado?tipo=pagar|receber - lista (não agregada) das contas
// em aberto (Pendente/Parcial) por trás dos KPIs "A Pagar/A Receber em aberto".
router.get("/contas-abertas-detalhado", authMiddleware, async (req, res) => {
  const tipo = req.query.tipo === "pagar" ? "pagar" : "receber";

  try {
    const pool = await getPool();
    const query =
      tipo === "pagar"
        ? `SELECT cp.idContaPagar AS IdConta, cp.NumeroDocumento, cp.Descricao, cp.DataEmissao,
                  cp.SaldoDevedor, cp.IdStatusContaPagar AS IdStatus, f.RazaoSocial AS Contraparte
           FROM ContaPagar cp
           LEFT JOIN Fornecedor f ON f.idFornecedor = cp.idFornecedor
           WHERE cp.IdStatusContaPagar IN ${STATUS_EM_ABERTO}
           ORDER BY cp.DataEmissao ASC`
        : `SELECT cr.IdContaReceber AS IdConta, cr.NumeroDocumento, cr.Descricao, cr.DataEmissao,
                  cr.SaldoDevedor, cr.IdStatusContaReceber AS IdStatus, cli.NomeCliente AS Contraparte
           FROM ContaReceber cr
           LEFT JOIN Cliente cli ON cli.idCliente = cr.idCliente
           WHERE cr.IdStatusContaReceber IN ${STATUS_EM_ABERTO}
           ORDER BY cr.DataEmissao ASC`;

    const result = await pool.request().query(query);
    res.json(
      result.recordset.map((r) => ({
        idConta: r.IdConta,
        numeroDocumento: r.NumeroDocumento,
        descricao: r.Descricao,
        dataEmissao: r.DataEmissao,
        saldoDevedor: Number(r.SaldoDevedor),
        idStatus: r.IdStatus,
        contraparte: r.Contraparte,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar contas em aberto" });
  }
});

export default router;
