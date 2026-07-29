export type SpacePalette = {
  id: string;
  lens: string;
  lights: string[];
};

export const spacePalettes: SpacePalette[] = [
  {
    id: 'neon',
    lens: '#FB99EA',
    lights: ['#F52E77', '#00C1E8', '#A855F7', '#22E584', '#FFB020', '#FF5CA8', '#4D7CFE', '#D8F050'],
  },
  {
    id: 'brasa',
    lens: '#FD9B05',
    lights: ['#EFA201', '#F85763', '#FF7A2F', '#E23B4E', '#FFC53D', '#FF8F6B', '#D96A29', '#F0B8A0'],
  },
  {
    id: 'selva',
    lens: '#F3FB77',
    lights: ['#B7E509', '#7BED4A', '#2ED573', '#D4F04F', '#0BCB8B', '#98E8B0', '#8AB80F', '#5EE6CE'],
  },
  {
    id: 'cobalto',
    lens: '#01B1FB',
    lights: ['#19ACF5', '#7132F2', '#3B5BFF', '#9D7BFF', '#00D1D1', '#5A8DFF', '#B14DFF', '#67D6F0'],
  },
  {
    id: 'coral',
    lens: '#FC768E',
    lights: ['#E04392', '#F98145', '#FF6B6B', '#F4A25C', '#D9578E', '#FFB0A0', '#C74E6B', '#FFD08A'],
  },
  {
    id: 'lima',
    lens: '#AEF65D',
    lights: ['#B7E408', '#25D6C3', '#8AE234', '#3EE8A0', '#D8F050', '#0FBFA5', '#9CCF20', '#6FE8D8'],
  },
];

export function paletteById(id?: string | null) {
  return spacePalettes.find((palette) => palette.id === id) ?? spacePalettes[0];
}
