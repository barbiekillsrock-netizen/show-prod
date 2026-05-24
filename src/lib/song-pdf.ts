import { jsPDF } from "jspdf";
import type { Song } from "@/data/songs";
import { getPdfObjectUrl } from "@/lib/pdf-storage";

const SAMPLES = {
  default: {
    intro: "G    D    Em    C",
    verse: [
      "G                  D",
      "Quando a noite cai sobre o palco",
      "Em                 C",
      "E as luzes acendem devagar",
      "G                    D",
      "Eu sinto a música no peito",
      "Em                C",
      "E começo a tocar",
    ],
    chorus: [
      "C              G",
      "É o som que nos une",
      "D              Em",
      "É a vida em canção",
      "C              G",
      "Cada acorde é uma história",
      "D              C",
      "Que cabe no coração",
    ],
  },
};

const demoCache = new Map<string, string>();

function buildDemoPdfUrl(song: Song): string {
  const cached = demoCache.get(song.id);
  if (cached) return cached;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(song.title, 40, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(110);
  doc.text(song.artist, 40, 82);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(`Tom: ${song.key}`, pageW - 40, 60, { align: "right" });
  doc.setDrawColor(200);
  doc.line(40, 100, pageW - 40, 100);

  const sample = SAMPLES.default;
  let y = 130;
  const writeBlock = (label: string, lines: string[]) => {
    doc.setFont("courier", "bold");
    doc.setFontSize(12);
    doc.text(label, 40, y);
    y += 18;
    doc.setFont("courier", "normal");
    for (const line of lines) {
      doc.text(line, 40, y);
      y += 16;
    }
    y += 14;
  };
  writeBlock("[Intro]", [sample.intro]);
  writeBlock("[Verso]", sample.verse);
  writeBlock("[Refrão]", sample.chorus);
  writeBlock("[Verso 2]", sample.verse);
  writeBlock("[Refrão]", sample.chorus);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(
    "Cifra de demonstração • CifraStage",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 20,
    { align: "center" },
  );

  const url = URL.createObjectURL(doc.output("blob"));
  demoCache.set(song.id, url);
  return url;
}

export class MissingUploadedPdfError extends Error {
  constructor(public songId: string) {
    super(`PDF não encontrado no armazenamento local (song ${songId})`);
    this.name = "MissingUploadedPdfError";
  }
}

export async function getSongPdfUrl(song: Song): Promise<string> {
  if (song.hasPdf) {
    const url = await getPdfObjectUrl(song.id);
    if (url) return url;
    // Não mascarar com a cifra demo: o usuário fez upload e espera ver o
    // arquivo dele. Sinalizar erro explicitamente.
    throw new MissingUploadedPdfError(song.id);
  }
  return buildDemoPdfUrl(song);
}
