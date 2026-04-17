export const MOCK_CLIPS = [
  {
    id: '1',
    name: 'Treino — V5 Overhang',
    meta: 'há 2 dias · 0:48',
    score: 87,
    duration: '0:48',
  },
  {
    id: '2',
    name: 'Red Point — V4 Slab',
    meta: 'há 5 dias · 1:12',
    score: 74,
    duration: '1:12',
  },
]

export const MOCK_ANALYSIS = {
  metrics: [
    { label: 'Pontuação geral', value: '87', unit: '/100', variant: 'good' },
    { label: 'Eficiência de quadril', value: '68', unit: '%', variant: 'warn' },
    { label: 'Arm reach', value: '+4', unit: 'cm', variant: 'good' },
    { label: 'Tensão de ombro', value: 'Alta', unit: '', variant: 'bad' },
  ],
  insights: [
    {
      type: 'Ponto forte',
      text: 'Sequência de pés consistente e precisa — contato limpo em 94% das pegadas.',
      variant: 'good',
    },
    {
      type: 'Para melhorar',
      text: 'Quadril afastado da parede nos movimentos de extensão — perda estimada de 15% de força de empuxo.',
      variant: 'warn',
    },
    {
      type: 'Atenção',
      text: 'Ombro direito em rotação interna excessiva aos 0:23. Risco de impingement com volume de treino alto.',
      variant: 'crit',
    },
  ],
}

export const MOCK_PHYSICS = {
  frame: 'frame 0:23',
  forces: [
    { label: 'Braço dir.', value: 82, level: 'high' },
    { label: 'Braço esq.', value: 47, level: 'med' },
    { label: 'Perna dir.', value: 61, level: 'med' },
    { label: 'Perna esq.', value: 39, level: 'low' },
    { label: 'Core', value: 55, level: 'neutral' },
  ],
  cog: {
    path: '20,80 60,65 100,55 140,48 180,52 220,60 260,72',
    peak: { x: 220, y: 60 },
    duration: '48s',
  },
}
