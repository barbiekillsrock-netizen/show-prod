import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

let pdfWorkerSrc: string | null = null;

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
  onPagesChange?: (info: { current: number; total: number }) => void;
};

export type PdfViewHandle = {
  scrollByPages: (delta: number) => void;
  scrollToStart: () => void;
  getPageInfo: () => { current: number; total: number };
};

const PdfView = forwardRef<PdfViewHandle, Props>(function PdfView(
  { file, width, height, onLoadSuccess, onPagesChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);
  const [error, setError] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      scrollByPages(delta: number) {
        const el = containerRef.current;
        if (!el) return;
        const cw = el.clientWidth || 1;
        el.scrollBy({ left: delta * cw, behavior: "smooth" });
      },
      scrollToStart() {
        containerRef.current?.scrollTo({ left: 0, behavior: "auto" });
      },
      getPageInfo() {
        const el = containerRef.current;
        if (!el) return { current: 0, total: 0 };
        const cw = el.clientWidth || 1;
        const total = Math.max(1, Math.round(el.scrollWidth / cw));
        const current = Math.round(el.scrollLeft / cw);
        return { current, total };
      },
    }),
    [],
  );

  // Notify scroll changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onPagesChange) return;
    const onScroll = () => {
      const cw = el.clientWidth || 1;
      const total = Math.max(1, Math.round(el.scrollWidth / cw));
      const current = Math.round(el.scrollLeft / cw);
      onPagesChange({ current, total });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onPagesChange]);

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

        // Fit each page within the available stage (object-contain)
        const fitScale = Math.min(
          width / baseViewport.width,
          height / baseViewport.height,
        );
        const dpr = window.devicePixelRatio || 1;

        container.innerHTML = "";

        for (let p = 1; p <= pdf.numPages; p++) {
          if (cancelled || runId !== runRef.current) return;
          const page = p === 1 ? firstPage : await pdf.getPage(p);
          if (cancelled || runId !== runRef.current) return;
          const viewport = page.getViewport({ scale: fitScale });

          // Slide wrapper = full stage width/height, snap target.
          const slide = document.createElement("div");
          slide.className =
            "flex-shrink-0 flex items-center justify-center overflow-y-auto overflow-x-hidden";
          slide.style.width = `${width}px`;
          slide.style.height = `${height}px`;
          slide.style.scrollSnapAlign = "start";
          slide.style.scrollSnapStop = "always";

          const canvas = document.createElement("canvas");
          canvas.className = "block bg-white";
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          slide.appendChild(canvas);
          container.appendChild(slide);

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

        if (onPagesChange) {
          onPagesChange({ current: 0, total: pdf.numPages });
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
  }, [file, height, onLoadSuccess, onPagesChange, width]);

  if (error) {
    return (
      <div className="text-destructive text-base p-6">
        Não foi possível abrir o PDF.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      aria-label="PDF da cifra"
      className="absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory pdf-scroll-x"
      style={{ scrollbarWidth: "none" }}
    />
  );
});

export default PdfView;
