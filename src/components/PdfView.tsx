import { useEffect, useRef, useState } from "react";

let pdfWorkerSrc: string | null = null;

type Props = {
  file: string;
  width: number;
  height: number;
  onLoadSuccess: (dims: { w: number; h: number }) => void;
};

export default function PdfView({ file, width, height, onLoadSuccess }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    if (!canvasRef.current || width <= 0 || height <= 0) return;

    async function renderPdf() {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setError(false);
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

        if (!pdfWorkerSrc) {
          pdfWorkerSrc = new URL(
            "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

        const pdf = await pdfjs.getDocument(file).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        onLoadSuccess({ w: baseViewport.width, h: baseViewport.height });

        const scale = Math.min(width / baseViewport.width, height / baseViewport.height);
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, viewport.width, viewport.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(true);
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
    };
  }, [file, height, onLoadSuccess, width]);

  if (error) {
    return (
      <div className="text-destructive text-base p-6">
        Não foi possível abrir o PDF.
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="block bg-white"
      style={{ width, height }}
      aria-label="PDF da cifra"
    />
  );
}
