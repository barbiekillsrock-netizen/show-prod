// Pré-aquece pdf.js (lib + worker) no boot do app para acelerar a 1ª abertura
// de qualquer cifra. Executa só no browser.
if (typeof window !== "undefined") {
  const preloadModule = (href: string) => {
    if (document.querySelector(`link[rel="modulepreload"][href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = href;
    document.head.appendChild(link);
  };

  // dispara o download da lib em paralelo com o resto da página
  import("pdfjs-dist/legacy/build/pdf.mjs")
    .then((pdfjs) => {
      const workerUrl = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      preloadModule(workerUrl);
    })
    .catch(() => {});
}

export {};
