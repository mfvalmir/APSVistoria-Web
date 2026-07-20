import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarServicos, desativarServico, Servico } from "../api/servico";
import { ItemMenu } from "../api/menu";
import ServicoForm from "./ServicoForm";
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import ThOrdenavel from "../components/ThOrdenavel";
import BotaoExportar from "../components/BotaoExportar";
import SeletorItensPorPagina from "../components/SeletorItensPorPagina";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import { obterItensPorPagina, salvarItensPorPagina } from "../utils/itensPorPagina";
import { useOrdenacao, ordenarLista } from "../utils/ordenacao";
import { colunasVisiveisParaExportacao } from "../utils/exportarCsv";
import { useToast } from "../contexts/ToastContext";
import { useConfirmacao } from "../contexts/ConfirmContext";
import "./ServicoPage.css";

type SubView = "lista" | "form";

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "descricao", label: "Descrição" },
  { chave: "valor", label: "Valor" },
  { chave: "status", label: "Status" },
];
const COLUNAS_PADRAO = ["descricao", "valor", "status"];

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ServicoPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function ServicoPage({ permissoes, voltarInicio }: ServicoPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;
  const podeExportar = permissoes?.imprimir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"A" | "I" | "">("A");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("servico", COLUNAS_PADRAO)
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => obterItensPorPagina("servico"));
  const { ordenacao, alternarOrdenacao } = useOrdenacao();
  const { mostrarToast } = useToast();
  const confirmar = useConfirmacao();

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("servico", novo);
      return novo;
    });
  }

  function alterarItensPorPagina(valor: number) {
    setItensPorPagina(valor);
    salvarItensPorPagina("servico", valor);
    setPagina(1);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarServicos(busca || undefined, status || undefined);
      setServicos(dados);
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

  async function handleExcluir(servico: Servico) {
    if (!(await confirmar({ mensagem: `Desativar o serviço "${servico.DescricaoServico}"?`, perigo: true })))
      return;
    try {
      await desativarServico(servico.idServico);
      carregar();
      mostrarToast("Serviço desativado com sucesso", "sucesso");
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        mostrarToast(err.response.data?.erro || "Não foi possível desativar o serviço", "erro");
      } else {
        mostrarToast("Não foi possível conectar ao servidor. Tente novamente.", "erro");
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
    return <ServicoForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const servicosOrdenados = ordenarLista(servicos, ordenacao, {
    id: (s) => s.idServico,
    descricao: (s) => s.DescricaoServico,
    valor: (s) => s.ValorServico,
    status: (s) => s.Situacao.trim(),
  });
  const colunasExportacao = colunasVisiveisParaExportacao<Servico>(COLUNAS, colunasVisiveis, {
    id: (s) => String(s.idServico),
    descricao: (s) => s.DescricaoServico,
    valor: (s) => formatarValor(s.ValorServico),
    status: (s) => (s.Situacao.trim() === "A" ? "ATIVO" : "INATIVO"),
  });

  const totalPaginas = Math.max(1, Math.ceil(servicosOrdenados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const servicosPagina = servicosOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  return (
    <div className="servico-page">
      <div className="servico-toolbar">
        <button
          type="button"
          className="servico-btn-voltar"
          title="Voltar para Início"
          aria-label="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="servico-busca">
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca && (
            <button
              type="button"
              className="servico-busca-limpar"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="servico-filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "A" | "I" | "")}
        >
          <option value="A">Ativos</option>
          <option value="I">Inativos</option>
          <option value="">Todos</option>
        </select>

        <div className="servico-toolbar-espaco" />

        {podeExportar && (
          <BotaoExportar
            nomeArquivo="servicos"
            titulo="Serviços"
            dados={servicosOrdenados}
            colunas={colunasExportacao}
          />
        )}

        {podeAdicionar && (
          <button className="servico-btn-criar" onClick={abrirCriacao}>
            Criar Serviço
          </button>
        )}
      </div>

      <div className={`servico-tabela-wrapper ${carregando ? "tabela-atualizando" : ""}`}>
        <table className="servico-tabela">
          <thead>
            <tr>
              {colunasVisiveis.has("id") && (
                <ThOrdenavel campo="id" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  ID
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("descricao") && (
                <ThOrdenavel campo="descricao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Descrição
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("valor") && (
                <ThOrdenavel campo="valor" ordenacao={ordenacao} onOrdenar={alternarOrdenacao}>
                  Valor
                </ThOrdenavel>
              )}
              {colunasVisiveis.has("status") && (
                <ThOrdenavel
                  campo="status"
                  ordenacao={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="servico-col-status"
                >
                  Status
                </ThOrdenavel>
              )}
              <th className="servico-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && servicosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="servico-vazio">Carregando...</td>
              </tr>
            ) : servicosPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="servico-vazio">Nenhum serviço encontrado</td>
              </tr>
            ) : (
              servicosPagina.map((s) => {
                const ativo = s.Situacao.trim() === "A";
                return (
                  <tr key={s.idServico}>
                    {colunasVisiveis.has("id") && <td>{s.idServico}</td>}
                    {colunasVisiveis.has("descricao") && <td>{s.DescricaoServico}</td>}
                    {colunasVisiveis.has("valor") && <td>{formatarValor(s.ValorServico)}</td>}
                    {colunasVisiveis.has("status") && (
                      <td className="servico-col-status">
                        <span className={`servico-badge ${ativo ? "ativo" : "inativo"}`}>
                          {ativo ? "ATIVO" : "INATIVO"}
                        </span>
                      </td>
                    )}
                    <td className="servico-col-acoes">
                      {podeEditar && (
                        <button
                          className="servico-icone-acao editar"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => abrirEdicao(s.idServico)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          className="servico-icone-acao perigo"
                          title="Desativar"
                          aria-label="Desativar"
                          onClick={() => handleExcluir(s)}
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

      <div className="servico-rodape">
        <span>{servicos.length} registros</span>
        <SeletorItensPorPagina valor={itensPorPagina} onAlterar={alterarItensPorPagina} />
        <div className="servico-paginacao">
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

export default ServicoPage;
