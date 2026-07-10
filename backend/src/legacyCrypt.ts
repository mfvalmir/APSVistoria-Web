// Reimplementação em TS da unit Delphi "Vcl.Criptar" (TCriptar), usada pelo
// sistema legado para gravar a coluna Senha da tabela `usuario`.
// XOR com chave repetida, resultado em hex minúsculo (2 chars por byte).

export function criptografar(key: string, texto: string): string {
  let resultado = "";
  for (let i = 0; i < texto.length; i++) {
    const textChar = texto.charCodeAt(i) & 0xff;
    const c = key.length > 0 ? (key.charCodeAt(i % key.length) & 0xff) ^ textChar : textChar;
    resultado += c.toString(16).padStart(2, "0");
  }
  return resultado;
}

export function descriptografar(key: string, hex: string): string {
  let resultado = "";
  for (let i = 0; i < hex.length / 2; i++) {
    let c = parseInt(hex.substr(i * 2, 2), 16);
    if (key.length > 0) {
      c = (key.charCodeAt(i % key.length) & 0xff) ^ c;
    }
    resultado += String.fromCharCode(c);
  }
  return resultado;
}
