export type Song = {
  id: string;
  title: string;
  artist: string;
  key: string;
};

export const songs: Song[] = [
  { id: "1", title: "Wish You Were Here", artist: "Pink Floyd", key: "G" },
  { id: "2", title: "Tempo Perdido", artist: "Legião Urbana", key: "D" },
  { id: "3", title: "Garota de Ipanema", artist: "Tom Jobim", key: "F" },
  { id: "4", title: "Black", artist: "Pearl Jam", key: "E" },
  { id: "5", title: "Sozinho", artist: "Caetano Veloso", key: "Am" },
  { id: "6", title: "Wonderwall", artist: "Oasis", key: "F#m" },
  { id: "7", title: "Hotel California", artist: "Eagles", key: "Bm" },
  { id: "8", title: "Hey Jude", artist: "The Beatles", key: "F" },
  { id: "9", title: "Trem-Bala", artist: "Ana Vilela", key: "C" },
  { id: "10", title: "Creep", artist: "Radiohead", key: "G" },
  { id: "11", title: "Eduardo e Mônica", artist: "Legião Urbana", key: "G#" },
  { id: "12", title: "Sunday Bloody Sunday", artist: "U2", key: "D" },
];
