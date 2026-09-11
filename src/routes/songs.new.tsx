import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { ArrowLeft, Upload, FileText, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { songsStore, VALID_KEYS, GENRES, normalizeKey, isValidKey } from "@/data/songs";

export const Route = createFileRoute("/songs/new")({
  component: AddSongPage,
});

export function AddSongPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [songKey, setSongKey] = useState("");
  const [keyError, setKeyError] = useState(false);
  const [genre, setGenre] = useState("");
  const [customGenre, setCustomGenre] = useState("");
  const [bpm, setBpm] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");
  const [genreOpen, setGenreOpen] = useState(false);
  const [keySuggestions, setKeySuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSave = title.trim() && artist.trim() && !keyError;

  function handleKeyChange(val: string) {
    setSongKey(val);
    setKeyError(false);
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
    setKeySuggestions([]);
    if (songKey.trim()) {
      if (!isValidKey(songKey)) {
        setKeyError(true);
      } else {
        setSongKey(normalizeKey(songKey));
        setKeyError(false);
      }
    }
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    await songsStore.add(
      {
        title: title.trim(),
        artist: artist.trim(),
        key: songKey.trim() ? normalizeKey(songKey) : "",
        genre: genre === "Outro" ? (customGenre.trim() || "Outro") : (genre || undefined),
        bpm: bpm.trim() ? Number(bpm) : undefined,
        lyrics: inputMode === "text" ? lyrics.trim() || undefined : undefined,
        pdfName: pdfFile?.name,
      },
      pdfFile ?? undefined,
    );
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Cancelar</span>
        </button>
        <h1 className="text-base font-semibold text-foreground">Nova Música</h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="text-sm font-bold text-primary disabled:opacity-40"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Form */}
      <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">

        {/* Título */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-14 px-4 rounded-xl bg-card border border-border text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Artista */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Artista</label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full h-14 px-4 rounded-xl bg-card border border-border text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Estilo */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Estilo <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <button
            type="button"
            onClick={() => setGenreOpen(!genreOpen)}
            className="w-full h-14 px-4 rounded-xl bg-card border border-border text-base text-foreground focus:outline-none flex items-center justify-between"
          >
            <span className={genre ? "text-foreground" : "text-muted-foreground"}>
              {genre || "Selecione um estilo..."}
            </span>
            {genreOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {genreOpen && (
            <div className="mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-lg">
              <button type="button" onClick={() => { setGenre(""); setGenreOpen(false); }}
                className="w-full text-left px-4 py-3 text-muted-foreground hover:bg-muted border-b border-border">
                Nenhum
              </button>
              {GENRES.map((g) => (
                <button key={g} type="button"
                  onClick={() => { setGenre(g); if (g !== "Outro") setCustomGenre(""); setGenreOpen(false); }}
                  className={`w-full text-left px-4 py-3 hover:bg-muted border-b border-border last:border-0 ${genre === g ? "text-primary font-semibold" : "text-foreground"}`}>
                  {g}
                </button>
              ))}
            </div>
          )}
          {genre === "Outro" && (
            <input type="text" value={customGenre} onChange={(e) => setCustomGenre(e.target.value)}
              placeholder="Digite o estilo..."
              className="mt-2 w-full h-14 px-4 rounded-xl bg-card border border-border text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          )}
        </div>

        {/* Tom */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Tom <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <div className="relative">
            <input type="text" value={songKey} onChange={(e) => handleKeyChange(e.target.value)}
              onBlur={handleKeyBlur} maxLength={4}
              className={`w-full h-14 px-4 rounded-xl bg-card border text-base text-foreground focus:outline-none focus:ring-2 ${keyError ? "border-red-500 focus:ring-red-500" : "border-border focus:ring-primary"}`} />
            {keySuggestions.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                {keySuggestions.map((k) => (
                  <button key={k} type="button"
                    onMouseDown={() => { setSongKey(k); setKeySuggestions([]); }}
                    className="w-full text-left px-4 py-3 text-primary hover:bg-muted border-b border-border last:border-0">
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>
          {keyError && <p className="mt-1 text-sm text-red-500">Tom inválido. Ex: Am, C#, Bb</p>}
        </div>

        {/* BPM */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            BPM <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input type="number" min="40" max="300" value={bpm} onChange={(e) => setBpm(e.target.value)}
            className="w-full h-14 px-4 rounded-xl bg-card border border-border text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {/* Modo PDF/Texto */}
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button type="button" onClick={() => setInputMode("pdf")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${inputMode === "pdf" ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"}`}>
              <span className="text-2xl">📄</span>
              <span className="text-sm font-semibold">Upload PDF</span>
            </button>
            <button type="button" onClick={() => setInputMode("text")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${inputMode === "text" ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"}`}>
              <span className="text-2xl">✏️</span>
              <span className="text-sm font-semibold">Digitar música</span>
            </button>
          </div>

          {inputMode === "text" ? (
            <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)}
              placeholder={"[G]  [D]\nWish you were here..."}
              className="w-full px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ minHeight: "200px" }} />
          ) : (
            <div>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
              {pdfFile ? (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pdfFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button type="button" onClick={() => setPdfFile(null)}
                    className="p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary/60">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-foreground font-medium">Selecionar PDF</span>
                  <span className="text-xs text-muted-foreground">Sem PDF, usamos uma música de demonstração</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Botão salvar */}
        <button type="button" onClick={handleSave} disabled={!canSave || saving}
          className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold text-base disabled:opacity-40">
          {saving ? "Salvando..." : "Adicionar Música"}
        </button>

        <div className="h-8" />
      </div>
    </div>
  );
}
