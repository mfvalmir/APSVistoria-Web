import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, Search, X, Pencil, Trash2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { listarClientes, excluirCliente, Cliente } from "../api/clientes";
import { ItemMenu } from "../api/menu";
import ClienteForm from "./ClienteForm";
import SeletorColunas, { OpcaoColuna } from "../components/SeletorColunas";
import { obterColunasVisiveis, salvarColunasVisiveis } from "../utils/colunasVisiveis";
import "./ClientesPage.css";

type SubView = "lista" | "form";

const ITENS_POR_PAGINA = 15;

const COLUNAS: OpcaoColuna[] = [
  { chave: "id", label: "ID" },
  { chave: "nome", label: "Nome" },
  { chave: "tipo", label: "Tipo" },
  { chave: "documento", label: "CPF/CNPJ" },
  { chave: "categoria", label: "Categoria" },
];
const COLUNAS_PADRAO = ["nome", "tipo", "documento", "categoria"];

interface ClientesPageProps {
  permissoes: ItemMenu["permissoes"] | null;
  administrador: boolean;
  voltarInicio: () => void;
}

function formatarCpfCnpjExibicao(valor: string, tipoPessoa: "F" | "J"): string {
  const d = valor.replace(/\D/g, "");
  if (tipoPessoa === "J") {
    if (d.length !== 14) return valor;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length !== 11) return valor;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function ClientesPage({ permissoes, voltarInicio }: ClientesPageProps) {
  const podeAdicionar = permissoes?.adicionar ?? false;
  const podeEditar = permissoes?.editar ?? false;
  const podeExcluir = permissoes?.excluir ?? false;

  const [subView, setSubView] = useState<SubView>("lista");
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState<"F" | "J" | "">("");
  const [pagina, setPagina] = useState(1);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() =>
    obterColunasVisiveis("clientes", COLUNAS_PADRAO)
  );

  function alternarColuna(chave: string) {
    setColunasVisiveis((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      salvarColunasVisiveis("clientes", novo);
      return novo;
    });
  }

  async function carregar() {
    setCarregando(true);
    try {
      const dados = await listarClientes(busca || undefined, tipoPessoa || undefined);
      setClientes(dados);
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
  }, [busca, tipoPessoa, subView]);

  async function handleExcluir(cliente: Cliente) {
    if (!window.confirm(`Excluir o cliente "${cliente.NomeCliente}"?`)) return;
    try {
      await excluirCliente(cliente.idCliente);
      carregar();
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        window.alert(err.response.data?.erro || "Não foi possível excluir o cliente");
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
    return <ClienteForm id={idSelecionado} onVoltar={voltarParaLista} />;
  }

  const totalPaginas = Math.max(1, Math.ceil(clientes.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const clientesPagina = clientes.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  return (
    <div className="clientes-page">
      <div className="clientes-toolbar">
        <button
          type="button"
          className="clientes-btn-voltar"
          title="Voltar para Início"
          onClick={voltarInicio}
        >
          <ArrowLeft size={18} />
        </button>

        <SeletorColunas colunas={COLUNAS} visiveis={colunasVisiveis} onToggle={alternarColuna} />

        <div className="clientes-busca">
          <Search size={16} />
          <input
            placeholder="Buscar por nome ou CPF/CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              className="clientes-busca-limpar"
              title="Limpar busca"
              onClick={() => setBusca("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="clientes-filtro-tipo"
          value={tipoPessoa}
          onChange={(e) => setTipoPessoa(e.target.value as "F" | "J" | "")}
        >
          <option value="">Todos os tipos</option>
          <option value="F">Física</option>
          <option value="J">Jurídica</option>
        </select>

        <div className="clientes-toolbar-espaco" />

        {podeAdicionar && (
          <button className="clientes-btn-criar" onClick={abrirCriacao}>
            Criar Cliente
          </button>
        )}
      </div>

      <div className="clientes-tabela-wrapper">
        <table className="clientes-tabela">
          <thead>
            <tr>
              {colunasVisiveis.has("id") && <th>ID</th>}
              {colunasVisiveis.has("nome") && <th>Nome</th>}
              {colunasVisiveis.has("tipo") && <th className="clientes-col-tipo">Tipo</th>}
              {colunasVisiveis.has("documento") && <th>CPF/CNPJ</th>}
              {colunasVisiveis.has("categoria") && <th>Categoria</th>}
              <th className="clientes-col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="clientes-vazio">Carregando...</td>
              </tr>
            ) : clientesPagina.length === 0 ? (
              <tr>
                <td colSpan={colunasVisiveis.size + 1} className="clientes-vazio">Nenhum cliente encontrado</td>
              </tr>
            ) : (
              clientesPagina.map((c) => (
                <tr key={c.idCliente}>
                  {colunasVisiveis.has("id") && <td>{c.idCliente}</td>}
                  {colunasVisiveis.has("nome") && <td>{c.NomeCliente}</td>}
                  {colunasVisiveis.has("tipo") && (
                    <td className="clientes-col-tipo">{c.TipoPessoa === "J" ? "Jurídica" : "Física"}</td>
                  )}
                  {colunasVisiveis.has("documento") && <td>{formatarCpfCnpjExibicao(c.CpfCnpj, c.TipoPessoa)}</td>}
                  {colunasVisiveis.has("categoria") && <td>{c.TipoCliente || "-"}</td>}
                  <td className="clientes-col-acoes">
                    {podeEditar && (
                      <button
                        className="clientes-icone-acao editar"
                        title="Editar"
                        onClick={() => abrirEdicao(c.idCliente)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        className="clientes-icone-acao perigo"
                        title="Excluir"
                        onClick={() => handleExcluir(c)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="clientes-rodape">
        <span>{clientes.length} registros</span>
        <div className="clientes-paginacao">
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

export default ClientesPage;
