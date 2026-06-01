import { useRef, useState, type FormEvent } from "react";
import { X, FileText, Upload, Trash2, ChevronDown } from "lucide-react";
import { songsStore, VALID_KEYS, GENRES, normalizeKey, isValidKey, type Song } from "@/data/songs";

export function AddSongDialog({
  open,
  onClose,
  song,
}: {
  open: boolean;
  onClose: () => void;
  song?: Song; // se passado, entra em modo edição
}) {
  const isEditing = Boolean(song);
  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "");
  const [songKey, setSongKey] = useState(song?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(false);
  const [keySuggestions, setKeySuggestions] = useState<string[]>([]);
  // Se o genre da música não está na lista GENRES, é customizado
  const isCustomGenre = Boolean(song?.genre && !GENRES.includes(song.genre));
  const [genre, setGenre] = useState(isCustomGenre ? "Outro" : (song?.genre ?? ""));
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [showPdfConfirm, setShowPdfConfirm] = useState(false);
  const [bpm, setBpm] = useState(song?.bpm ? String(song.bpm) : "");
  const [customGenre, setCustomGenre] = useState(isCustomGenre ? (song?.genre ?? "") : "");
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const keyError = keyTouched && songKey.trim() !== "" && !isValidKey(songKey);
  const canSubmit = title.trim() && artist.trim() && !keyError;

  function reset() {
    setTitle(song?.title ?? "");
    setArtist(song?.artist ?? "");
    setSongKey(song?.key ?? "");
    setKeyTouched(false);
    setKeySuggestions([]);
    const _isCustom = Boolean(song?.genre && !GENRES.includes(song.genre));
    setGenre(_isCustom ? "Outro" : (song?.genre ?? ""));
    setBpm(song?.bpm ? String(song.bpm) : "");
    setPdfFile(null);
    setCustomGenre(_isCustom ? (song?.genre ?? "") : "");
  }

  function handleKeyChange(val: string) {
    setSongKey(val);
    if (val.trim()) {
      const q = val.trim().toLowerCase();
      setKeySuggestions(
        VALID_KEYS.filter((k) => k.toLowerCase().startsWith(q) && k.toLowerCase() !== q)
      );
    } else {
      setKeySuggestions([]);
    }
  }

  function handleKeyBlur() {
    setKeyTouched(true);
    setKeySuggestions([]);
    if (songKey.trim()) {
      setSongKey(normalizeKey(songKey));
    }
  }

  function pickSuggestion(k: string) {
    setSongKey(k);
    setKeySuggestions([]);
    setKeyTouched(false);
  }

  function handlePick(file: File | null | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Por favor, selecione um arquivo PDF.");
      return;
    }
    // Se está editando e já tem PDF cadastrado, pede confirmação
    if (isEditing && song?.hasPdf) {
      setPendingPdfFile(file);
      setShowPdfConfirm(true);
    } else {
      setPdfFile(file);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (isEditing && song) {
      await songsStore.update(
        song.id,
        {
          title: title.trim(),
          artist: artist.trim(),
          key: songKey.trim() ? normalizeKey(songKey) : "",
          genre: genre === "Outro" ? (customGenre.trim() || "Outro") : (genre || undefined),
        bpm: bpm.trim() ? Number(bpm) : undefined,
        },
        pdfFile,
      );
    } else {
      await songsStore.add(
        {
          title: title.trim(),
          artist: artist.trim(),
          key: songKey.trim() ? normalizeKey(songKey) : "",
          genre: genre === "Outro" ? (customGenre.trim() || "Outro") : (genre || undefined),
          bpm: bpm.trim() ? Number(bpm) : undefined,
          pdfName: pdfFile?.name,
        },
        pdfFile,
      );
    }
    reset();
    onClose();
  }

  return (
    {/* Modal de confirmação de troca de PDF */}
    {showPdfConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl">
          <h3 className="text-lg font-bold text-foreground mb-2">Trocar arquivo da cifra?</h3>
          <p className="text-sm text-muted-foreground mb-6">
            O novo arquivo será usado em <span className="text-foreground font-medium">todos os setlists</span> que contêm esta música. Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setPendingPdfFile(null); setShowPdfConfirm(false); }}
              className="h-11 px-5 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => { setPdfFile(pendingPdfFile); setPendingPdfFile(null); setShowPdfConfirm(false); }}
              className="h-11 px-5 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90"
            >
              Confirmar troca
            </button>
          </div>
        </div>
      </div>
    )}

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
              {isEditing ? "Editar Cifra" : "Adicionar Nova Cifra"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEditing ? "Atualize os dados da música." : "Cadastre uma música no seu repertório."}
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
          {/* Título */}
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

          {/* Artista */}
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

          {/* Estilo */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Estilo{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <select
                value={genre}
                onChange={(e) => { setGenre(e.target.value); if (e.target.value !== "Outro") setCustomGenre(""); }}
                className="w-full h-12 pl-4 pr-10 rounded-lg bg-background border border-border text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="">Selecione um estilo...</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            {genre === "Outro" && (
              <input
                autoFocus
                value={customGenre}
                onChange={(e) => setCustomGenre(e.target.value)}
                placeholder="Digite o estilo..."
                className="mt-2 w-full h-12 px-4 rounded-lg bg-background border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>

          {/* Tom */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tom{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <input
                value={songKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                onBlur={handleKeyBlur}
                onFocus={() => setKeyTouched(false)}
                placeholder="Ex.: G, Am, F#"
                maxLength={4}
                className={`w-full h-12 px-4 rounded-lg bg-background border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
                  keyError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-border focus:ring-primary"
                }`}
              />
              {/* Autocomplete dropdown */}
              {keySuggestions.length > 0 && (
                <ul className="absolute z-10 top-full mt-1 w-full bg-[#1E1E1E] border border-border rounded-lg shadow-xl overflow-hidden">
                  {keySuggestions.map((k) => (
                    <li key={k}>
                      <button
                        type="button"
                        onMouseDown={() => pickSuggestion(k)}
                        className="w-full text-left px-4 py-2.5 text-base text-[#00E5FF] hover:bg-muted transition-colors"
                      >
                        {k}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {keyError && (
              <p className="mt-1.5 text-sm text-red-500">
                Tom inválido. Ex: Am, C#, Bb
              </p>
            )}
          </div>

          {/* BPM */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              BPM{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              min="40"
              max="300"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              placeholder="Ex.: 120"
              className="w-full h-12 px-4 rounded-lg bg-background border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* PDF */}
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
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
              disabled={!canSubmit}
              className="h-12 px-6 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
            >
              {isEditing ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
