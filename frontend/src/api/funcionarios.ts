import { api } from "./client";

export interface FuncionarioResumo {
  IdFuncionario: number;
  NomeFuncionario: string;
}

export interface Funcionario {
  IdFuncionario: number;
  NomeFuncionario: string;
  Endereco: string | null;
  CEP: string | null;
  idBairro: number | null;
  DescricaoBairro: string | null;
  TelCelular: string | null;
  TelResidencial: string | null;
  idFuncao: number | null;
  Funcao: string | null;
  FazVistoria: boolean;
  DataAdmissao: string | null;
  Salario: number | null;
  IDBanco: number | null;
  DescricaoBanco: string | null;
  Agencia: string | null;
  NumContaBanco: string | null;
  CPF: string | null;
  ChavePix: string | null;
  DataNascimento: string | null;
  Observacao: string | null;
  Situacao: string;
}

export interface DadosFuncionario {
  nomeFuncionario: string;
  endereco?: string;
  cep?: string;
  idBairro?: number | null;
  telCelular?: string;
  telResidencial?: string;
  idFuncao?: number | null;
  fazVistoria: boolean;
  dataAdmissao?: string;
  salario?: number | null;
  idBanco?: number | null;
  agencia?: string;
  numContaBanco?: string;
  cpf?: string;
  chavePix?: string;
  dataNascimento?: string;
  observacao?: string;
}

export interface EdicaoFuncionario extends DadosFuncionario {
  situacao: "A" | "I";
}

export interface FuncaoOpcao {
  idFuncao: number;
  descricao: string;
}

export interface BancoOpcao {
  idBanco: number;
  DescricaoBanco: string;
}

export interface BairroOpcao {
  IDBairro: number;
  DescricaoBairro: string;
  DescricaoCidade: string | null;
  UF: string | null;
}

export async function buscarFuncionarios(
  busca: string,
  opcoes?: { semUsuario?: boolean; somenteVistoriador?: boolean }
): Promise<FuncionarioResumo[]> {
  const { data } = await api.get<FuncionarioResumo[]>("/funcionarios/buscar", {
    params: {
      busca,
      semUsuario: opcoes?.semUsuario ? "1" : undefined,
      somenteVistoriador: opcoes?.somenteVistoriador ? "1" : undefined,
    },
  });
  return data;
}

export async function listarFuncionarios(busca?: string, status?: "A" | "I"): Promise<Funcionario[]> {
  const { data } = await api.get<Funcionario[]>("/funcionarios", { params: { busca, status } });
  return data;
}

export async function obterFuncionario(id: number): Promise<Funcionario> {
  const { data } = await api.get<Funcionario>(`/funcionarios/${id}`);
  return data;
}

export async function criarFuncionario(dados: DadosFuncionario): Promise<void> {
  await api.post("/funcionarios", dados);
}

export async function atualizarFuncionario(id: number, dados: EdicaoFuncionario): Promise<void> {
  await api.put(`/funcionarios/${id}`, dados);
}

export async function desativarFuncionario(id: number): Promise<void> {
  await api.delete(`/funcionarios/${id}`);
}

export async function buscarFuncoes(): Promise<FuncaoOpcao[]> {
  const { data } = await api.get<FuncaoOpcao[]>("/funcionarios/funcoes");
  return data;
}

export async function buscarBancos(): Promise<BancoOpcao[]> {
  const { data } = await api.get<BancoOpcao[]>("/funcionarios/bancos");
  return data;
}

export async function buscarBairros(busca: string): Promise<BairroOpcao[]> {
  const { data } = await api.get<BairroOpcao[]>("/funcionarios/bairros", { params: { busca } });
  return data;
}
