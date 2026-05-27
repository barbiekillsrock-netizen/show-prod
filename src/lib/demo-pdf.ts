import { jsPDF } from "jspdf";
import type { Song } from "@/data/songs";

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

export function buildDemoPdfUrl(song: Song): string {
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
    "Cifra de demonstração • ShowProd",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 20,
    { align: "center" },
  );

  return URL.createObjectURL(doc.output("blob"));
}