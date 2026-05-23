## Problema
Na tela de performance (cifra em execução durante o show), não há nenhum controle visível para avançar/voltar entre as cifras do setlist. A navegação existe (setas do teclado, zonas invisíveis de 50px nas laterais e swipe), mas o usuário não tem como descobrir.

## Solução
Adicionar controles visíveis de navegação na tela `/performance`, mantendo os atalhos atuais (teclado e swipe) como complemento.

### Mudanças em `src/routes/performance.tsx`

1. **Botões laterais visíveis (Anterior / Próxima)**
   - Substituir as zonas invisíveis de 50px por dois botões flutuantes com o ícone `ChevronLeft` / `ChevronRight`, posicionados verticalmente ao centro nas bordas esquerda e direita.
   - Estilo consistente com a top bar: `bg-card/70 backdrop-blur border border-border`, tamanho confortável para toque (h-12 w-12), `rounded-full`.
   - Desabilitar (opacity reduzida + `disabled`) o botão "Anterior" quando `activeIdx === 0` e "Próxima" quando estiver na última.
   - Manter swipe lateral e atalhos de teclado (← →, Esc) já existentes.

2. **Indicador de progresso clicável (barra de miniaturas / dots)**
   - Logo abaixo do título central, mostrar uma linha de "dots" (um por cifra do setlist).
   - Dot ativo destacado com `bg-primary`; demais com `bg-muted`.
   - Cada dot é clicável e salta direto para aquela cifra (`setActiveIdx(i)`), útil para setlists com várias músicas.

3. **Dica de uso na primeira vez (opcional, simples)**
   - Um pequeno texto/legenda no rodapé (ex.: "Use ← → ou as setas laterais") visível apenas por ~3s ao abrir a primeira cifra, depois some.

### Fora de escopo
- Não mexer em armazenamento, setlists, store de músicas, PDF storage, nem nas ferramentas de edição (caneta/borracha/cor/salvar).
- Não alterar a lógica de `from`/`exitTo` nem o fluxo de saída.

## Arquivos afetados
- `src/routes/performance.tsx` (somente UI)
