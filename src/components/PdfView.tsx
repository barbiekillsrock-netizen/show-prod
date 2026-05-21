import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

type Props = {
  file: string;
  width: number;
  height: number;
  onLoadSuccess: (dims: { w: number; h: number }) => void;
};

export default function PdfView({ file, width, height, onLoadSuccess }: Props) {
  return (
    <Document
      file={file}
      loading={
        <div className="text-muted-foreground text-base p-6">
          Carregando cifra...
        </div>
      }
      error={
        <div className="text-destructive text-base p-6">
          Não foi possível abrir o PDF.
        </div>
      }
    >
      <Page
        pageNumber={1}
        width={width}
        height={height}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onLoadSuccess={(p) =>
          onLoadSuccess({ w: p.originalWidth, h: p.originalHeight })
        }
      />
    </Document>
  );
}
