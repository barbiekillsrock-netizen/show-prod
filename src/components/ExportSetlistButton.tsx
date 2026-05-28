import { Share2 } from "lucide-react";
import type { Setlist } from "@/data/setlists";
import type { Song } from "@/data/songs";

async function shareSetlistPdf(setlist: Setlist, songs: Song[]) {
  const validSongs = setlist.songIds
    .map((id) => songs.find((s) => s.id === id))
    .filter((s): s is Song => Boolean(s));

  // Imports dinâmicos — nunca executam no SSR
  const { jsPDF } = await import("jspdf");
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  const { getPdfBlob } = await import("@/lib/pdf-storage");
  const { buildDemoPdfBytes } = await import("@/lib/demo-pdf");

  // ── 1. Capa com jsPDF ────────────────────────────────────────────────────
  const cover = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 16;
  let y = 20;

  cover.setFillColor(10, 10, 10);
  cover.rect(0, 0, W, 28, "F");
  cover.setTextColor(0, 229, 255);
  cover.setFontSize(18);
  cover.setFont("helvetica", "bold");
  cover.text("ShowProd", margin, 13);
  cover.setTextColor(255, 255, 255);
  cover.setFontSize(11);
  cover.setFont("helvetica", "normal");
  cover.text("Setlist de Show", margin, 21);
  y = 38;

  cover.setTextColor(20, 20, 20);
  cover.setFontSize(16);
  cover.setFont("helvetica", "bold");
  cover.text(setlist.name, margin, y);
  y += 7;

  cover.setFontSize(9);
  cover.setFont("helvetica", "normal");
  cover.setTextColor(100, 100, 100);
  cover.text(
    `${validSongs.length} música${validSongs.length !== 1 ? "s" : ""}  •  ${new Date().toLocaleDateString("pt-BR")}`,
    margin, y
  );
  y += 8;

  cover.setDrawColor(0, 229, 255);
  cover.setLineWidth(0.5);
  cover.line(margin, y, W - margin, y);
  y += 8;

  cover.setFillColor(245, 245, 245);
  cover.rect(margin, y - 4, W - margin * 2, 8, "F");
  cover.setFontSize(8);
  cover.setFont("helvetica", "bold");
  cover.setTextColor(80, 80, 80);
  cover.text("#", margin + 2, y + 1);
  cover.text("Título", margin + 10, y + 1);
  cover.text("Artista", margin + 90, y + 1);
  cover.text("Tom", margin + 145, y + 1);
  cover.text("Estilo", margin + 162, y + 1);
  y += 10;

  validSongs.forEach((song, i) => {
    if (y > 270) { cover.addPage(); y = 20; }
    if (i % 2 === 0) {
      cover.setFillColor(250, 250, 250);
      cover.rect(margin, y - 4, W - margin * 2, 8, "F");
    }
    cover.setFontSize(9);
    cover.setTextColor(30, 30, 30);
    cover.setFont("helvetica", "bold");
    cover.text(String(i + 1), margin + 2, y + 1);
    const title = song.title.length > 32 ? song.title.slice(0, 30) + "…" : song.title;
    cover.text(title, margin + 10, y + 1);
    cover.setFont("helvetica", "normal");
    cover.setTextColor(80, 80, 80);
    const artist = song.artist.length > 22 ? song.artist.slice(0, 20) + "…" : song.artist;
    cover.text(artist, margin + 90, y + 1);
    if (song.key) {
      cover.setFillColor(0, 229, 255);
      cover.roundedRect(margin + 143, y - 3, 14, 6, 1, 1, "F");
      cover.setTextColor(10, 10, 10);
      cover.setFont("helvetica", "bold");
      cover.setFontSize(7.5);
      cover.text(song.key, margin + 145, y + 1);
    }
    if (song.genre) {
      cover.setFont("helvetica", "normal");
      cover.setFontSize(8);
      cover.setTextColor(100, 100, 100);
      cover.text(song.genre, margin + 162, y + 1);
    }
    y += 9;
  });

  cover.setDrawColor(220, 220, 220);
  cover.setLineWidth(0.3);
  cover.line(margin, 285, W - margin, 285);
  cover.setFontSize(7);
  cover.setTextColor(160, 160, 160);
  cover.text("Gerado por ShowProd", margin, 290);

  const coverBytes = cover.output("arraybuffer");

  // ── 2. Merge nativo com pdf-lib (zero perda de qualidade) ────────────────
  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.HelveticaBold);

  // Copia páginas da capa
  const coverDoc = await PDFDocument.load(coverBytes);
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
  coverPages.forEach((p) => merged.addPage(p));

  // Concatena PDFs das músicas — merge vetorial puro
  for (const song of validSongs) {
    try {
      let pdfBytes: ArrayBuffer | null = null;
      if (song.hasPdf) {
        const blob = await getPdfBlob(song.id);
        if (blob) pdfBytes = await blob.arrayBuffer();
      } else {
        pdfBytes = buildDemoPdfBytes(song);
      }
      if (!pdfBytes) continue;

      const songDoc = await PDFDocument.load(pdfBytes);
      const pages = await merged.copyPages(songDoc, songDoc.getPageIndices());

      // Cabeçalho discreto na primeira página — desenhado sobre o PDF
      if (pages.length > 0) {
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        const barH = height * 0.032; // 3.2% da altura

        // Faixa preta semitransparente no topo
        firstPage.drawRectangle({
          x: 0,
          y: height - barH,
          width,
          height: barH,
          color: rgb(0, 0, 0),
          opacity: 0.82,
        });

        // Texto do cabeçalho
        const parts = [
          `${validSongs.indexOf(song) + 1}. ${song.title}`,
          song.artist,
          song.key ? `[${song.key}]` : "",
          song.bpm ? `${song.bpm} BPM` : "",
        ].filter(Boolean).join("  ·  ");

        const fontSize = barH * 0.52;
        firstPage.drawText(parts, {
          x: width * 0.012,
          y: height - barH * 0.75,
          size: fontSize,
          font,
          color: rgb(0, 0.898, 1), // #00E5FF
        });
      }

      pages.forEach((p) => merged.addPage(p));
    } catch {
      // pula silenciosamente
    }
  }

  const mergedBytes = await merged.save();
  const filename = `${setlist.name.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "setlist"}.pdf`;
  const blob = new Blob([mergedBytes], { type: "application/pdf" });
  const file = new File([blob], filename, { type: "application/pdf" });

  // ── 3. Web Share API ou download ─────────────────────────────────────────
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
