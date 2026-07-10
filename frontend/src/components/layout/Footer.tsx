import { useEffect, useState } from "react";
import { buscarInfoSistema } from "../../api/sistema";
import "./Footer.css";

function Footer() {
  const [banco, setBanco] = useState("");

  useEffect(() => {
    buscarInfoSistema()
      .then((info) => setBanco(info.banco))
      .catch(() => setBanco(""));
  }, []);

  return (
    <footer className="app-footer">
      <span>APS Vistoria &copy; {new Date().getFullYear()}</span>
      {banco && <span>Banco de dados: {banco}</span>}
      <span>Desenvolvido por Valmir Fco. Magalhães</span>
    </footer>
  );
}

export default Footer;
