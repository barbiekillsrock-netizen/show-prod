import type { Song } from "@/data/songs";
import { getPdfObjectUrl } from "@/lib/pdf-storage";

const demoCache = new Map<string, string>();

async function getDemoPdfUrl(song: Song): Promise<string> {
  const cached = demoCache.get(song.id);
  if (cached) return cached;
  const { buildDemoPdfUrl } = await import("@/lib/demo-pdf");
  const url = buildDemoPdfUrl(song);
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
  return getDemoPdfUrl(song);
}
