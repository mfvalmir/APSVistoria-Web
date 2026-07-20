import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import "./OfflineBanner.css";

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const { mostrarToast } = useToast();

  useEffect(() => {
    function handleOnline() {
      setOffline(false);
      mostrarToast("Conexão com a internet restaurada", "sucesso");
    }
    function handleOffline() {
      setOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [mostrarToast]);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="alert">
      <WifiOff size={15} />
      Sem conexão com a internet. Verifique sua rede.
    </div>
  );
}

export default OfflineBanner;
