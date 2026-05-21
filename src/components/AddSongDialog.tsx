import { useRef, useState, type FormEvent } from "react";
import { X, FileText, Upload, Trash2 } from "lucide-react";
import { songsStore } from "@/data/songs";

export function AddSongDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [songKey, setSongKey] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function reset() {
    setTitle("");
    setArtist("");
    setSongKey("");
    setPdfFile(null);
  }

  function handlePick(file: File | null | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Por favor, selecione um arquivo PDF.");
      return;
    }
    setPdfFile(file);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !artist.trim() || !songKey.trim()) return;
    const pdfUrl = pdfFile ? URL.createObjectURL(pdfFile) : undefined;
    songsStore.add({
      title: title.trim(),
      artist: artist.trim(),
      key: songKey.trim(),
      pdfUrl,
      pdfName: pdfFile?.name,
    });
    reset();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-2xl font-bold text-foreground">
              Adicionar Nova Cifra
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre uma música no seu repertório.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Título
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Wish You Were Here"
              className="w-full h-12 px-4 rounded-lg bg-background border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Artista
            </label>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Ex.: Pink Floyd"
              className="w-full h-12 px-4 rounded-lg bg-background border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tom
            </label>
            <input
              value={songKey}
              onChange={(e) => setSongKey(e.target.value)}
              placeholder="Ex.: G, Am, F#"
              className="w-full h-12 px-4 rounded-lg bg-background border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Arquivo PDF da cifra{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => handlePick(e.target.files?.[0])}
            />

            {pdfFile ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {pdfFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(pdfFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfFile(null)}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive min-h-[48px] min-w-[48px] flex items-center justify-center"
                  aria-label="Remover PDF"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handlePick(e.dataTransfer.files?.[0]);
                }}
                className={`w-full flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-lg border-2 border-dashed transition-colors min-h-[48px] ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/60 hover:bg-muted/40"
                }`}
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-foreground font-medium">
                  Clique para selecionar ou arraste o PDF
                </span>
                <span className="text-xs text-muted-foreground">
                  Sem PDF, usamos uma cifra de demonstração
                </span>
              </button>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-12 px-5 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-muted min-h-[48px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !artist.trim() || !songKey.trim()}
              className="h-12 px-6 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
