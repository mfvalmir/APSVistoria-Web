import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarContasReceber, excluirContaReceber, ContaReceber, STATUS_CONTA_RECEBER } from "../api/contaReceber";
import { ItemMenu } from "../api/menu";
import ContaReceberForm from "./ContaReceberForm";
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import "./ContaReceberPage.css";

type SubView = "lista" | "form";

const ITENS_POR_PAGINA = 15;

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "numeroDocumento", label: "Documento" },
  { chave: "descricao", label: "Descrição" },
  { chave: "cliente", label: "Cliente" },
  { chave: "categoria", label: "Categoria" },
  { chave: "valorTotal", label: "Valor Total" },
  { chave: "saldoDevedor", label: "Saldo Devedor" },
  { chave: "dataEmissao", label: "Emissão" },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = [
  "descricao",
  "cliente",
  "categoria",
  "valorTotal",
  "saldoDevedor",
  "dataEmissao",
  "status",
];

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(valor: string): string {
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function statusInfo(idStatus: number): { label: string; classe: string } {
  const item = STATUS_CONTA_RECEBER.find((s) => s.valor === idStatus);
  const classes: Record<number, string> = { 0: "pendente", 1: "pago", 2: "parcial", 3: "cancelado" };
  return { label: item?.label ?? "-", classe: classes[idStatus] ?? "pendente" };
}

interface ContaReceberPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  navegarPara?: (rota: string, nome: string, grupo: string) => void;
  voltarInicio: () => void;
}

function ContaReceberPage({ permissoes, navegarPara, voltarInicio }: ContaReceberPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<number | "">("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("conta-receber", COLUNAS_PADRAO)
  );

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("conta-receber", novo);
      return novo;
    });
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarContasReceber(busca || undefined, status);
      setContas(dados);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (subView !== "lista") return;
    const timeout = setTimeout(() => {
      setPagina(1);
      carregar();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, status, subView]);

  async function handleExcluir(conta: ContaReceber) {
    if (
      !window.confirm(
        `Excluir definitivamente a conta "${conta.Descricao}"? Isso remove também todas as parcelas, mesmo as já pagas.`
      )
    )
      return;
    try {
      await excluirContaReceber(conta.IdContaReceber);
      carregar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        window.alert(err.response.data?.erro || "Não foi possível excluir a conta a receber");
      } else {
        window.alert("Não foi possível conectar ao servidor. Tente novamente.");
      }
    }
  }

  function abrirCriacao() {
    setIdSelecionado(null);
    setSubView("form");
  }

  function abrirEdicao(id: number) {
    setIdSelecionado(id);
    setSubView("form");
  }

  function voltarParaLista() {
    setSubView("lista");
    carregar();
  }

  if (subView === "form") {
    return (
      <ContaReceberForm
        id={idSelecionado}
        onVoltar={voltarParaLista}
        navegarPara={navegarPara}
        permissoes={permissoes}
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(contas.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const contasPagina = contas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  return (
    <div className="conta-receber-page">
      <div className="conta-receber-toolbar">
        <button
          type="button"
          className="conta-receber-btn-voltar"
          title="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="conta-receber-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="conta-receber-busca-limpar"
              title="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="conta-receber-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Todos os status</option>
          {STATUS_CONTA_RECEBER.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="conta-receber-toolbar-espaco" />

        {podeAdicionar && (
          <button className="conta-receber-btn-criar" onClick={abrirCriacao}>
            Criar Conta a Receber
          </button>
        )}
      </div>

      <div className="conta-receber-tabela-wrapper">
        <table className="conta-receber-tabela">
          <thead>
            <tr>
              {colunasVisiveis.has("id") && <th>ID</th>}
              {colunasVisiveis.has("numeroDocumento") && <th>Documento</th>}
              {colunasVisiveis.has("descricao") && <th>Descrição</th>}
              {colunasVisiveis.has("cliente") && <th>Cliente</th>}
              {colunasVisiveis.has("categoria") && <th>Categoria</th>}
              {colunasVisiveis.has("valorTotal") && <th className="conta-receber-col-valor">Valor Total</th>}
              {colunasVisiveis.has("saldoDevedor") && <th className="conta-receber-col-valor">Saldo Devedor</th>}
              {colunasVisiveis.has("dataEmissao") && <th>Emissão</th>}
              {colunasVisiveis.has("status") && <th className="conta-receber-col-status">Status</th>}
              <th className="conta-receber-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="conta-receber-vazio">Carregando...</td>
              </tr>
            ) : contasPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="conta-receber-vazio">
                  Nenhuma conta a receber encontrada
                </td>
              </tr>
            ) : (
              contasPagina.map((c) => {
                const { label, classe } = statusInfo(c.IdStatusContaReceber);
                return (
                  <tr key={c.IdContaReceber}>
                    {colunasVisiveis.has("id") && <td>{c.IdContaReceber}</td>}
                    {colunasVisiveis.has("numeroDocumento") && <td>{c.NumeroDocumento || "-"}</td>}
                    {colunasVisiveis.has("descricao") && <td>{c.Descricao}</td>}
                    {colunasVisiveis.has("cliente") && <td>{c.NomeCliente || "-"}</td>}
                    {colunasVisiveis.has("categoria") && <td>{c.DescricaoCategoria}</td>}
                    {colunasVisiveis.has("valorTotal") && (
                      <td className="conta-receber-col-valor">{formatarValor(c.ValorTotal)}</td>
                    )}
                    {colunasVisiveis.has("saldoDevedor") && (
                      <td className="conta-receber-col-valor">{formatarValor(c.SaldoDevedor)}</td>
                    )}
                    {colunasVisiveis.has("dataEmissao") && <td>{formatarData(c.DataEmissao)}</td>}
                    {colunasVisiveis.has("status") && (
                      <td className="conta-receber-col-status">
                        <span className={`conta-receber-badge ${classe}`}>{label.toUpperCase()}</span>
                      </td>
                    )}
                    <td className="conta-receber-col-acoes">
                      {podeEditar && (
                        <button
                          className="conta-receber-icone-acao editar"
                          title="Editar"
                          onClick={() => abrirEdicao(c.IdContaReceber)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="conta-receber-icone-acao perigo"
                          title="Excluir"
                          onClick={() => handleExcluir(c)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="conta-receber-rodape">
        <span>{contas.length} registros</span>
        <div className="conta-receber-paginacao">
          <button disabled={paginaAtual === 1} onClick={() => setPagina(1)}>
            <ChevronsLeft size={16} />
          </button>
          <button disabled={paginaAtual === 1} onClick={() => setPagina((p) => p - 1)}>
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPaginas }, (_, i) => i + 1)
            .slice(Math.max(0, paginaAtual - 3), paginaAtual + 2)
            .map((p) => (
              <button key={p} className={p === paginaAtual ? "ativa" : ""} onClick={() => setPagina(p)}>
                {p}
              </button>
            ))}
          <button disabled={paginaAtual === totalPaginas} onClick={() => setPagina((p) => p + 1)}>
            <ChevronRight size={16} />
          </button>
          <button disabled={paginaAtual === totalPaginas} onClick={() => setPagina(totalPaginas)}>
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContaReceberPage;
