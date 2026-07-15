import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import "./Modal.css";

interface ModalProps {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
}

function Modal({ titulo, onFechar, children }: ModalProps) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="modal-painel" role="dialog" aria-modal="true">
        <div className="modal-cabecalho">
          <h3>{titulo}</h3>
          <button type="button" className="modal-fechar" onClick={onFechar} title="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
