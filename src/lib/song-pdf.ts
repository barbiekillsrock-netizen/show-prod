import { jsPDF } from "jspdf";
import type { Song } from "@/data/songs";

// Sample chord progressions for demo PDFs
const SAMPLES: Record<string, { intro: string; verse: string[]; chorus: string[] }> = {
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

const blobCache = new Map<string, string>();

export function getSongPdfUrl(song: Song): string {
  if (song.pdfUrl) return song.pdfUrl;
  const cached = blobCache.get(song.id);
  if (cached) return cached;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
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

  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text("[Intro]", 40, y);
  y += 18;
  doc.setFont("courier", "normal");
  doc.text(sample.intro, 40, y);
  y += 30;

  doc.setFont("courier", "bold");
  doc.text("[Verso]", 40, y);
  y += 18;
  doc.setFont("courier", "normal");
  for (const line of sample.verse) {
    doc.text(line, 40, y);
    y += 16;
  }
  y += 14;

  doc.setFont("courier", "bold");
  doc.text("[Refrão]", 40, y);
  y += 18;
  doc.setFont("courier", "normal");
  for (const line of sample.chorus) {
    doc.text(line, 40, y);
    y += 16;
  }
  y += 14;

  doc.setFont("courier", "bold");
  doc.text("[Verso 2]", 40, y);
  y += 18;
  doc.setFont("courier", "normal");
  for (const line of sample.verse) {
    doc.text(line, 40, y);
    y += 16;
  }
  y += 14;

  doc.setFont("courier", "bold");
  doc.text("[Refrão]", 40, y);
  y += 18;
  doc.setFont("courier", "normal");
  for (const line of sample.chorus) {
    doc.text(line, 40, y);
    y += 16;
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(
    "Cifra de demonstração • CifraStage",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 20,
    { align: "center" },
  );

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  blobCache.set(song.id, url);
  return url;
}
