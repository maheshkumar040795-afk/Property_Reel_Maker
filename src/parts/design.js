const LAYOUTS = {
  card: { name: 'Card', trans: 'fade' },
  split: { name: 'Split', trans: 'slide' },
  magazine: { name: 'Magazine', trans: 'zoom' },
  bold: { name: 'Bold', trans: 'slide' },
  minimal: { name: 'Minimal', trans: 'fade' },
  frame: { name: 'Polaroid', trans: 'zoom' }
};
const PALETTES = {
  brand: { name: 'Brand' },
  midnight: { name: 'Midnight Gold', main: '#0E1B2A', accent: '#E8BB5C' },
  royal: { name: 'Royal Blue', main: '#0F2A5F', accent: '#F5B700' },
  emerald: { name: 'Emerald', main: '#0F3D2E', accent: '#E9C46A' },
  terracotta: { name: 'Terracotta', main: '#5A2A1F', accent: '#F2A65A' },
  coral: { name: 'Charcoal Coral', main: '#1F2328', accent: '#FF6B5B' },
  plum: { name: 'Plum Rose', main: '#3B1E3F', accent: '#F4A6B8' },
  teal: { name: 'Ocean Teal', main: '#0B3C49', accent: '#4FD1C5' },
  sunset: { name: 'Sunset', main: '#2B1B12', accent: '#FF8A3D' },
  mono: { name: 'Black & White', main: '#111111', accent: '#FFFFFF' }
};
const FONTS = { modern: { name: 'Modern' }, elegant: { name: 'Elegant' }, bold: { name: 'Bold' } };
// old admin template names → designs
const LEGACY = { classic: { layout: 'card', palette: 'brand', font: 'modern' }, luxury: { layout: 'magazine', palette: 'midnight', font: 'elegant', grain: true }, bright: { layout: 'split', palette: 'brand', font: 'modern' }, plots: { layout: 'bold', palette: 'emerald', font: 'bold' } };
const D = () => state.design;
const TH = () => ({ serif: D().font === 'elegant', trans: (LAYOUTS[D().layout] || LAYOUTS.card).trans, grain: !!D().grain, frame: D().layout === 'magazine' });
const PAL = () => { const p = PALETTES[D().palette]; return p && p.main ? { main: p.main, accent: p.accent } : { main: state.brand.main, accent: state.brand.accent }; };
const TF = () => D().font === 'elegant' ? true : D().font === 'bold' ? 'display' : false;   // title face
const UP = s => D().font === 'bold' ? String(s || '').toUpperCase() : s;
const TS = n => D().font === 'bold' ? Math.round(n * 1.18) : n;                              // display font is narrow
