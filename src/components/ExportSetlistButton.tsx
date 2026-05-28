import { Share2 } from "lucide-react";
import type { Setlist } from "@/data/setlists";
import type { Song } from "@/data/songs";

async function shareSetlistPdf(setlist: Setlist, songs: Song[]) {
  const validSongs = setlist.songIds
    .map((id) => songs.find((s) => s.id === id))
    .filter((s): s is Song => Boolean(s));

  // Imports dinâmicos — nunca executam no SSR
  const { jsPDF } = await import("jspdf");
  const { getPdfBlob } = await import("@/lib/pdf-storage");
  const { buildDemoPdfBytes } = await import("@/lib/demo-pdf");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const margin = 16;
  let y = 20;

  // ── Capa ──────────────────────────────────────────────────────────────────
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(0, 229, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ShowProd", margin, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Setlist de Show", margin, 21);
  y = 38;

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(setlist.name, margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${validSongs.length} música${validSongs.length !== 1 ? "s" : ""}  •  ${new Date().toLocaleDateString("pt-BR")}`,
    margin, y
  );
  y += 8;

  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 8;

  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, W - margin * 2, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("#", margin + 2, y + 1);
  doc.text("Título", margin + 10, y + 1);
  doc.text("Artista", margin + 90, y + 1);
  doc.text("Tom", margin + 145, y + 1);
  doc.text("Estilo", margin + 162, y + 1);
  y += 10;

  validSongs.forEach((song, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 4, W - margin * 2, 8, "F");
    }
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(String(i + 1), margin + 2, y + 1);
    const title = song.title.length > 32 ? song.title.slice(0, 30) + "…" : song.title;
    doc.text(title, margin + 10, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const artist = song.artist.length > 22 ? song.artist.slice(0, 20) + "…" : song.artist;
    doc.text(artist, margin + 90, y + 1);
    if (song.key) {
      doc.setFillColor(0, 229, 255);
      doc.roundedRect(margin + 143, y - 3, 14, 6, 1, 1, "F");
      doc.setTextColor(10, 10, 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(song.key, margin + 145, y + 1);
    }
    if (song.genre) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(song.genre, margin + 162, y + 1);
    }
    y += 9;
  });

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, 285, W - margin, 285);
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text("Gerado por ShowProd", margin, 290);

  // ── Cifras: cada página ocupa A4 inteira, cabeçalho discreto no topo ──────
  for (const song of validSongs) {
    try {
      let pdfBytes: ArrayBuffer;
      if (song.hasPdf) {
        const blob = await getPdfBlob(song.id);
        if (!blob) continue;
        pdfBytes = await blob.arrayBuffer();
      } else {
        pdfBytes = buildDemoPdfBytes(song);
      }

      const pdfDoc = await pdfjs.getDocument({ data: pdfBytes }).promise;

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        doc.addPage();
        const page = await pdfDoc.getPage(pageNum);

        // Calcula viewport para preencher A4 exato (595 x 842 pt)
        const naturalVp = page.getViewport({ scale: 1 });
        const scaleX = 595 / naturalVp.width;
        const scaleY = 842 / naturalVp.height;
        const scale = Math.max(scaleX, scaleY); // cobre a página inteira
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Cabeçalho: faixa preta no topo com texto ciano
        // Altura = 3% da página — discreto mas legível
        if (pageNum === 1) {
          const barH = Math.round(canvas.height * 0.032);
          const parts = [
            `${validSongs.indexOf(song) + 1}. ${song.title}`,
            song.artist,
            song.key ? `[${song.key}]` : "",
            song.bpm ? `${song.bpm} BPM` : "",
          ].filter(Boolean).join("  ·  ");

          ctx.fillStyle = "rgba(0,0,0,0.82)";
          ctx.fillRect(0, 0, canvas.width, barH);
          ctx.fillStyle = "#00E5FF";
          const fs = Math.round(barH * 0.52);
          ctx.font = `600 ${fs}px sans-serif`;
          ctx.fillText(parts, Math.round(canvas.width * 0.012), Math.round(barH * 0.72));
        }

        // Página A4 inteira: x=0, y=0, largura=210mm, altura=297mm
        const imgData = canvas.toDataURL("image/jpeg", 0.93);
        doc.addImage(imgData, "JPEG", 0, 0, 210, 297);
      }
    } catch {
      // pula silenciosamente
    }
  }

  // ── Compartilha ───────────────────────────────────────────────────────────
  const filename = `${setlist.name.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "setlist"}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: setlist.name });
  } else if (navigator.share) {
    const url = URL.createObjectURL(blob);
    await navigator.share({ title: setlist.name, url });
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export function ExportSetlistButton({ setlist, songs }: { setlist: Setlist; songs: Song[] }) {
  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    await shareSetlistPdf(setlist, songs);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition p-2 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary"
      aria-label="Exportar e compartilhar setlist"
      title="Compartilhar PDF"
    >
      <Share2 className="h-4 w-4" />
    </button>
  );
}
