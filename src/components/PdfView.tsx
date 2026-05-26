import { useEffect, useRef, useState } from "react";

let pdfWorkerSrc: string | null = null;

// Preload pdfjs module as soon as this file is imported (client only)
let pdfjsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;
function loadPdfjs() {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsPromise;
}
if (typeof window !== "undefined") {
  loadPdfjs().catch(() => {});
}

const docCache = new Map<string, Promise<import("pdfjs-dist/legacy/build/pdf.mjs").PDFDocumentProxy>>();

type Props = {
  file: string;
  width: number;
  height: number;
  onLoadSuccess: (dims: { w: number; h: number }) => void;
};

export default function PdfView({ file, width, height, onLoadSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!containerRef.current || width <= 0 || height <= 0) return;

    let cancelled = false;
    const runId = ++runRef.current;
    const container = containerRef.current;
    const activeTasks: Array<{ cancel: () => void }> = [];

    async function renderPdf() {
      try {
        setError(false);
        const pdfjs = await loadPdfjs();
        if (cancelled || runId !== runRef.current) return;

        if (!pdfWorkerSrc) {
          pdfWorkerSrc = new URL(
            "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

        let docPromise = docCache.get(file);
        if (!docPromise) {
          docPromise = pdfjs.getDocument(file).promise;
          docCache.set(file, docPromise);
        }
        const pdf = await docPromise;
        if (cancelled || runId !== runRef.current) return;

        const firstPage = await pdf.getPage(1);
        if (cancelled || runId !== runRef.current) return;
        const baseViewport = firstPage.getViewport({ scale: 1 });
        onLoadSuccess({ w: baseViewport.width, h: baseViewport.height });

        // Fit first page using width AND height (object-contain),
        // remaining pages reuse the same scale so the layout is consistent.
        const fitScale = Math.min(
          width / baseViewport.width,
          height / baseViewport.height,
        );
        const dpr = window.devicePixelRatio || 1;

        // Clear container
        container.innerHTML = "";

        for (let p = 1; p <= pdf.numPages; p++) {
          if (cancelled || runId !== runRef.current) return;
          const page = p === 1 ? firstPage : await pdf.getPage(p);
          if (cancelled || runId !== runRef.current) return;
          const viewport = page.getViewport({ scale: fitScale });

          const canvas = document.createElement("canvas");
          canvas.className = "block bg-white mx-auto";
          if (p > 1) canvas.style.marginTop = "12px";
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const task = page.render({ canvas, canvasContext: ctx, viewport });
          activeTasks.push(task);
          try {
            await task.promise;
          } catch (err) {
            if (err instanceof Error && err.name === "RenderingCancelledException") return;
            throw err;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "RenderingCancelledException") return;
        console.error(err);
        if (!cancelled) setError(true);
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
      for (const t of activeTasks) {
        try {
          t.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [file, height, onLoadSuccess, width]);

  if (error) {
    return (
      <div className="text-destructive text-base p-6">
        Não foi possível abrir o PDF.
      </div>
    );
  }

  return <div ref={containerRef} aria-label="PDF da cifra" />;
}
