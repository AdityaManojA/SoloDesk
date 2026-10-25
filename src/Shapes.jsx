// Decorative shapes from the 1.02 design. Purely visual: hidden from assistive technology.
const paths = {
  heart: { box: '0 0 24 22', d: 'M12 21s-9-5.6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.4-9 12-9 12z' },
  cross: { box: '0 0 24 24', d: 'M8.5 1.5h7v7h7v7h-7v7h-7v-7h-7v-7h7z' },
  star: { box: '0 0 24 24', d: 'M12 0l2.3 6.4L20.5 3.5l-2.9 6.2L24 12l-6.4 2.3 2.9 6.2-6.2-2.9L12 24l-2.3-6.4-6.2 2.9 2.9-6.2L0 12l6.4-2.3L3.5 3.5l6.2 2.9z' },
  arc: { box: '0 0 24 12', d: 'M0 0h5.5a6.5 6.5 0 0 0 13 0H24a12 12 0 0 1-24 0z' },
  triangle: { box: '0 0 24 21', d: 'M12 0l12 21H0z' },
};
export default function Shape({ kind = 'heart', size = 120, color = 'var(--hero-deep)', style }) {
  const p = paths[kind];
  return <svg className="shape" aria-hidden="true" focusable="false" viewBox={p.box} width={size} style={style}><path d={p.d} fill={color} /></svg>;
}
