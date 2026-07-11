function calcularDigitoCPF(base: string, pesoInicial: number): number {
  let soma = 0;
  let peso = pesoInicial;
  for (const d of base) {
    soma += Number(d) * peso;
    peso--;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCPF(valor: string): boolean {
  const cpf = valor.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const d1 = calcularDigitoCPF(cpf.slice(0, 9), 10);
  const d2 = calcularDigitoCPF(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

// Pesos do CNPJ ciclam 2..9 da direita pra esquerda (não é decremento linear como o CPF).
function calcularDigitoCNPJ(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCNPJ(valor: string): boolean {
  const cnpj = valor.replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const d1 = calcularDigitoCNPJ(cnpj.slice(0, 12));
  const d2 = calcularDigitoCNPJ(cnpj.slice(0, 13));
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}
