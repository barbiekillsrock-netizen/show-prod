## Problemas a resolver

### Bug 1 — PDF da cifra "some" e tela volta sozinha para Setlists
Causa raiz:
- As músicas vivem apenas em memória (`songsStore` em `src/data/songs.ts`). Qualquer reload / navegação que perca o módulo apaga tudo.
- O PDF é guardado como `URL.createObjectURL(file)` (blob URL). Esse URL só vive enquanto o documento existir — após reload ele aponta para nada e o PDF "some".
- Em `/performance`, quando `setlist.length === 0` o `useEffect` redireciona para `/setlists`. Como o store é volátil, em alguns casos a música nova ainda não está no array no primeiro render → redireciona sozinho.

### Bug 2 — Setlists precisa virar CRUD com múltiplos setlists
Hoje existe um único setlist hard-coded ("Show de Sábado — Corporativo") com estado local. Precisamos de N setlists coexistindo, com criar / editar / excluir.

---

## Plano de implementação

### 1. Persistência de músicas + PDFs (resolve Bug 1)
- Criar `src/lib/pdf-storage.ts` usando **IndexedDB** (sem dependências) para guardar Blobs de PDF por `songId`. API: `savePdf(id, file)`, `getPdfUrl(id)` (gera object URL na hora a partir do Blob salvo), `deletePdf(id)`.
- Refatorar `src/data/songs.ts`:
  - Persistir metadados (id, title, artist, key, hasPdf, pdfName) em `localStorage` (chave `songs:v1`).
  - Manter o `useSyncExternalStore` para reatividade.
  - `add()` agora aceita `pdfFile?: File`, salva no IndexedDB e marca `hasPdf: true`.
  - `remove(id)` apaga também do IndexedDB.
- `src/lib/song-pdf.ts`: passar a resolver o URL via `pdf-storage` (assíncrono) com fallback para o PDF de demonstração.
- `AddSongDialog.tsx`: usar a nova API (`songsStore.add({...}, pdfFile)`).
- `performance.tsx`: como `pdfUrl` vira assíncrono, usar `useEffect` + `useState` para resolver, e **remover o redirect automático** quando `setlist` ficar vazio por 1 frame (esperar `mounted` antes de redirecionar, e só redirecionar se `ids` estiver realmente vazio).

### 2. CRUD de Setlists (resolve Bug 2)
- Criar `src/data/setlists.ts` (mesmo padrão de store + `localStorage`):
  ```ts
  type Setlist = { id: string; name: string; songIds: string[]; createdAt: number };
  setlistsStore: { get, subscribe, create, rename, remove, setSongs }
  useSetlists(): Setlist[]
  ```
- Refatorar `src/routes/setlists.tsx` em duas views:
  - **Lista de setlists** (default): grid de cards, botão "Novo setlist", cada card mostra nome, nº de músicas, duração estimada, botões Editar / Iniciar / Excluir.
  - **Editor de setlist** (`?id=<setlistId>`): a UI atual de 2 colunas (repertório à esquerda, roteiro do setlist à direita), título editável inline, botão "Iniciar Show" e "Voltar".
  - Usar `validateSearch` com `id?: string` para alternar entre as duas views sem criar nova rota.
- Persistir alterações no store em tempo real (drag/drop, remove, reorder, rename).
- "Iniciar Show" continua navegando para `/performance` com `ids` e `name` do setlist atual.

### 3. Pequenos ajustes
- `SongCard` continua funcionando (abre cifra individual em `/performance`).
- Atualizar `routeTree.gen.ts` é automático.

## Arquivos afetados
- novo: `src/lib/pdf-storage.ts`
- novo: `src/data/setlists.ts`
- edit: `src/data/songs.ts`
- edit: `src/lib/song-pdf.ts`
- edit: `src/components/AddSongDialog.tsx`
- edit: `src/routes/performance.tsx`
- edit: `src/routes/setlists.tsx`

Sem mudanças de backend — tudo client-side (IndexedDB + localStorage), o que já basta para resolver os dois bugs.