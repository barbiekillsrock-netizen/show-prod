// Pré-aquece pdf.js (lib + worker) no boot do app para acelerar a 1ª abertura
// de qualquer cifra. Executa só no browser.
if (typeof window !== "undefined") {
  // dispara o download da lib em paralelo com o resto da página
  import("pdfjs-dist/legacy/build/pdf.mjs")
    .then((pdfjs) => {
      const workerUrl = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      // força o browser a buscar o worker agora (cache HTTP) — assim quando
      // o PdfView for montado pela 1ª vez, o worker já está pronto.
      fetch(workerUrl, { mode: "no-cors" }).catch(() => {});
    })
    .catch(() => {});
}

export {};
