// Inicializa o plugin de teclado do Capacitor
// Garante que inputs recebem foco corretamente no Android WebView

import { Capacitor } from "@capacitor/core";

export function initKeyboard() {
  if (!Capacitor.isNativePlatform()) return;

  // Foca o elemento ativo quando o teclado fecha
  // Isso corrige o bug de perda de foco no Android WebView
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT"
    ) {
      setTimeout(() => {
        (target as HTMLInputElement).focus();
      }, 100);
    }
  });
}
