import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import "./ToastContext.css";

type TipoToast = "sucesso" | "erro" | "info";

interface ToastItem {
  id: number;
  mensagem: string;
  tipo: TipoToast;
}

interface ToastContextValue {
  mostrarToast: (mensagem: string, tipo?: TipoToast) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONE_POR_TIPO: Record<TipoToast, typeof CheckCircle2> = {
  sucesso: CheckCircle2,
  erro: XCircle,
  info: Info,
};

const DURACAO_MS = 7000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const proximoId = useRef(0);

  const remover = useCallback((id: number) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  const mostrarToast = useCallback(
    (mensagem: string, tipo: TipoToast = "info") => {
      const id = ++proximoId.current;
      setToasts((atual) => [...atual, { id, mensagem, tipo }]);
      setTimeout(() => remover(id), DURACAO_MS);
    },
    [remover]
  );

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => {
          const Icone = ICONE_POR_TIPO[t.tipo];
          return (
            <div key={t.id} className={`toast toast-${t.tipo}`} role="status">
              <Icone size={18} />
              <span className="toast-mensagem">{t.mensagem}</span>
              <button type="button" className="toast-fechar" onClick={() => remover(t.id)} aria-label="Fechar">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}
