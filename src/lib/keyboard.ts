import { Capacitor } from "@capacitor/core";

export function initKeyboard() {
  if (!Capacitor.isNativePlatform()) return;

  // Fix global para inputs no Android WebView
  // O WebView perde foco após interações com elementos nativos
  document.addEventListener("touchend", (e) => {
    const target = e.target as HTMLElement;
    const isInput = 
      target.tagName === "INPUT" || 
      target.tagName === "TEXTAREA";
    
    if (isInput) {
      e.preventDefault();
      const input = target as HTMLInputElement;
      
      // Foca e posiciona cursor no final
      setTimeout(() => {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }, 50);
      
      setTimeout(() => {
        input.focus();
      }, 150);
      
      setTimeout(() => {
        input.focus();
      }, 300);
    }
  }, { passive: false });
}
