export const products = [
  {
    id: 'bottle',
    name: 'Garrafa Térmica',
    price: 129.90,
    image: '/GarrafaCapa.webp',
    category: { id: 'termicos-personalizados', name: 'Térmicos Personalizados' },
    subcategory: { id: 'garrafas-termicas', name: 'Garrafas Térmicas' },
    personalizationArea: { x: 30, y: 25, width: 40, height: 45 },
    options: {
      colors: [
        { id: 'pink', name: 'Rosa', hex: '#FFC0CB', image: '/Garrafa_Rosa.webp' },
        { id: 'black', name: 'Preto', hex: '#111111', image: '/Garrafa_Preto.webp' },
        { id: 'white', name: 'Branco', hex: '#F9F9F9', image: '/Garrafa_branca.webp' },
        { id: 'purple', name: 'Roxo', hex: '#4527A0', image: '/Garrafa_Roxo.webp' },
        { id: 'red', name: 'Vermelho', hex: '#A6282A', image: '/Garrafa_Vermelho.webp' }
      ],
      sizes: [
        { id: '500', name: '500ml' },
        { id: '1000', name: '1L' }
      ]
    }
  },
  {
    id: 'cup',
    name: 'Copo Térmico',
    price: 99.90,
    image: '/CopoCapa.webp',
    category: { id: 'termicos-personalizados', name: 'Térmicos Personalizados' },
    subcategory: { id: 'copos-termicos', name: 'Copos Térmicos' },
    personalizationArea: { x: 28, y: 20, width: 44, height: 40 },
    options: {
      colors: [
        { id: 'blue', name: 'Azul', hex: '#005BBB', image: '/copo_cuia_azul.webp' },
        { id: 'white', name: 'Branco', hex: '#FFFFFF', image: '/copo_cuia_branco.webp' },
        { id: 'black', name: 'Preto', hex: '#111111', image: '/copo_cuia_preto.webp' }
      ],
      sizes: [
        { id: '473', name: '473ml' },
      ]
    }
  },
  {
    id: 'case',
    name: 'Capa Personalizada',
    price: 69.90,
    image: '/TPUCapa.webp',
    category: { id: 'capas-personalizadas', name: 'Capas Personalizadas' },
    personalizationArea: { x: 25, y: 15, width: 50, height: 55 },
    options: {
      colors: [
        { id: 'clear', name: 'Transparente', hex: '#F0F8FF' },
        { id: 'smoke', name: 'Fumê', hex: '#696969' }
      ],
      models: [
        { id: 'ip14', name: 'iPhone 14' },
        { id: 'ip14p', name: 'iPhone 14 Pro' },
        { id: 's23', name: 'Galaxy S23' }
      ]
    }
  }
];
