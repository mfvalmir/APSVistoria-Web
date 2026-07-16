// `new Date("YYYY-MM-DD")` é sempre interpretado pelo JS como meia-noite UTC, nunca meia-noite
// local. O driver mssql (useUTC: false em db.ts) serializa parâmetros DATE/DATETIME usando os
// getters LOCAIS do objeto Date - então uma data "2026-07-16" vinda de um <input type="date">
// do frontend, ao virar `new Date("2026-07-16")`, tem seus getters locais apontando pro dia
// anterior às 21h (Brasília = UTC-3), e é isso que acaba gravado no banco.
// `parseDataLocal` evita o problema construindo o Date já com os componentes locais certos.
export function parseDataLocal(valor: string): Date {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}
