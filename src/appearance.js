// Action colour (Settings → Appearance). The Terracotta palette stays fixed; only --hero changes.
// Every option keeps black text readable on it.
export const ACTION_COLOURS = [
  { id: 'terracotta', name: 'Terracotta', hex: '#E8957A', deep: '#D27556' },
  { id: 'clay', name: 'Clay', hex: '#D9825B', deep: '#BB6E4D' },
  { id: 'rust', name: 'Rust', hex: '#CC6E47', deep: '#AF5F3D' },
  { id: 'apricot', name: 'Apricot', hex: '#F2A477', deep: '#D08D66' },
  { id: 'sienna', name: 'Sienna', hex: '#E07B53', deep: '#C16A47' },
  { id: 'brick', name: 'Brick', hex: '#CF6A4C', deep: '#B25B41' },
  { id: 'peach', name: 'Peach', hex: '#F3AE86', deep: '#D19673' },
  { id: 'dusty-blue', name: 'Dusty blue', hex: '#A3B8C4', deep: '#8C9EA8' },
  { id: 'coral', name: 'Coral', hex: '#F28B74', deep: '#D07764' },
  { id: 'mustard', name: 'Mustard', hex: '#E5B94E', deep: '#C59F43' },
  { id: 'olive', name: 'Olive', hex: '#B3B76E', deep: '#9A9D5F' },
  { id: 'sage', name: 'Sage', hex: '#A7B98B', deep: '#8FA270' },
  { id: 'teal', name: 'Teal', hex: '#86B8B1', deep: '#739E98' },
  { id: 'sky', name: 'Sky', hex: '#9DC3E0', deep: '#87A8C1' },
  { id: 'lavender', name: 'Lavender', hex: '#B8A9DC', deep: '#9E91BD' },
  { id: 'stone', name: 'Stone', hex: '#C9BBA6', deep: '#ADA18F' },
];
export const isCustomColour = id => /^#[0-9a-f]{6}$/i.test(id || '');
const darken = hex => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.86).toString(16).padStart(2, '0')).join('');
// Rough readability check for black text on a custom colour (relative luminance).
export function readableWithBlack(hex) { const l = [1, 3, 5].map(i => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] > 0.18; }
export const DEFAULT_ACTION = 'terracotta';
export const actionColour = id => isCustomColour(id) ? { id, name: 'Custom', hex: id, deep: darken(id) } : ACTION_COLOURS.find(c => c.id === id) || ACTION_COLOURS[0];

export function applyActionColour(id, root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return;
  const colour = actionColour(id);
  root.style.setProperty('--hero', colour.hex);
  root.style.setProperty('--hero-deep', colour.deep);
  root.dataset.action = colour.id;
}
