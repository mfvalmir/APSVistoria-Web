import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import Modal from "../components/Modal";
import "./ConfirmContext.css";

interface OpcoesConfirmacao {
  titulo?: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  perigo?: boolean;
}

type EntradaConfirmacao = string | OpcoesConfirmacao;

interface PedidoConfirmacao {
  opcoes: OpcoesConfirmacao;
  resolver: (valor: boolean) => void;
}

const ConfirmContext = createContext<((entrada: EntradaConfirmacao) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);

  const confirmar = useCallback((entrada: EntradaConfirmacao) => {
    const opcoes: OpcoesConfirmacao = typeof entrada === "string" ? { mensagem: entrada } : entrada;
    return new Promise<boolean>((resolver) => {
      setPedido({ opcoes, resolver });
    });
  }, []);

  function responder(valor: boolean) {
    pedido?.resolver(valor);
    setPedido(null);
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {pedido && (
        <Modal titulo={pedido.opcoes.titulo || "Confirmar ação"} onFechar={() => responder(false)}>
          <p className="confirm-modal-mensagem">{pedido.opcoes.mensagem}</p>
          <div className="confirm-modal-acoes">
            <button
              type="button"
              className={`confirm-modal-btn-confirmar${pedido.opcoes.perigo ? " perigo" : ""}`}
              onClick={() => responder(true)}
              autoFocus
            >
              {pedido.opcoes.textoConfirmar || "Confirmar"}
            </button>
            <button type="button" className="confirm-modal-btn-cancelar" onClick={() => responder(false)}>
              {pedido.opcoes.textoCancelar || "Cancelar"}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

// Retorna uma função que abre o modal de confirmação e resolve true/false conforme a escolha
// do usuário - substitui window.confirm mantendo o mesmo uso (await confirmar(...)) mas sem
// travar a thread nem destoar do resto da UI.
export function useConfirmacao(): (entrada: EntradaConfirmacao) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirmacao deve ser usado dentro de ConfirmProvider");
  return ctx;
}
