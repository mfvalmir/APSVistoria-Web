import { useRef } from "react";
import Modal from "../components/Modal";
import ClienteForm from "./ClienteForm";
import { Cliente } from "../api/clientes";

interface ClienteModalProps {
  onCancelar: () => void;
  onCriado: (cliente: Cliente) => void;
}

// Reaproveita o ClienteForm inteiro (inclusive o cadastro de múltiplos responsáveis, que só é
// possível depois que o cliente tem idCliente) em vez de duplicar a lógica num form reduzido.
function ClienteModal({ onCancelar, onCriado }: ClienteModalProps) {
  const clienteCriadoRef = useRef<Cliente | null>(null);

  function handleFechar() {
    if (clienteCriadoRef.current) {
      onCriado(clienteCriadoRef.current);
    } else {
      onCancelar();
    }
  }

  return (
    <Modal titulo="Novo Cliente" onFechar={handleFechar}>
      <ClienteForm
        id={null}
        onVoltar={handleFechar}
        mostrarCabecalho={false}
        aoCriarCliente={(cliente) => {
          clienteCriadoRef.current = cliente;
        }}
      />
    </Modal>
  );
}

export default ClienteModal;
