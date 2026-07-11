import { KeyboardEvent } from "react";

// Faz o Enter pular pro próximo campo em vez de submeter o form (padrão em telas com muitos campos).
// Não se aplica dentro de textarea (Enter deve quebrar linha) nem em botões (Enter deve acionar normalmente).
export function focarProximoCampoAoEnter(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;

  const alvo = e.target as HTMLElement;
  if (alvo.tagName === "TEXTAREA" || alvo.tagName === "BUTTON") return;

  e.preventDefault();

  const form = e.currentTarget;
  const focaveis = Array.from(
    form.querySelectorAll<HTMLElement>("input, select, textarea, button")
  ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

  const indiceAtual = focaveis.indexOf(alvo);
  const proximo = focaveis[indiceAtual + 1];
  if (proximo) proximo.focus();
}
