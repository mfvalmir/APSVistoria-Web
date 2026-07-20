import "./SeletorItensPorPagina.css";

const OPCOES = [10, 15, 25, 50, 100];

interface SeletorItensPorPaginaProps {
  valor: number;
  onAlterar: (valor: number) => void;
}

function SeletorItensPorPagina({ valor, onAlterar }: SeletorItensPorPaginaProps) {
  return (
    <label className="seletor-itens-pagina">
      Itens por página:
      <select value={valor} onChange={(e) => onAlterar(Number(e.target.value))}>
        {OPCOES.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </label>
  );
}

export default SeletorItensPorPagina;
