import {useLayoutEffect, useRef} from 'react';

// Mobile dock: one terracotta blob slides behind the selected tab. On a change it stretches like a drop
// of liquid (the leading edge runs ahead, the trailing edge catches up, it squashes while stretched),
// then wobbles into place. Reduced-motion users get a plain jump.
export function DockBlob({page}) {
  const ref = useRef(null), last = useRef(null);
  useLayoutEffect(() => {
    const blob = ref.current, nav = blob?.parentElement; if (!nav) return;
    const place = (animate) => {
      const icon = nav.querySelector('a.on .dock-icon');
      if (!icon) { blob.style.opacity = '0'; last.current = null; return; }
      const n = nav.getBoundingClientRect(), r = icon.getBoundingClientRect();
      const to = {l: r.left - n.left, w: r.width, t: r.top - n.top, h: r.height};
      Object.assign(blob.style, {opacity: '1', top: to.t + 'px', height: to.h + 'px', left: to.l + 'px', width: to.w + 'px'});
      const from = last.current; last.current = to;
      const still = !animate || !from || Math.abs(from.l - to.l) < 1 || matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still) return;
      const right = to.l > from.l, span = Math.abs(to.l - from.l) + to.w;
      const lead = right ? {l: from.l, w: span} : {l: to.l, w: span};
      blob.animate([
        {left: from.l + 'px', width: from.w + 'px', transform: 'scaleY(1)'},
        {left: lead.l + 'px', width: lead.w + 'px', transform: 'scaleY(.62)', offset: .42},
        {left: (to.l + (right ? -6 : 0)) + 'px', width: (to.w + 6) + 'px', transform: 'scaleY(1.12)', offset: .72},
        {left: to.l + 'px', width: to.w + 'px', transform: 'scaleY(.96)', offset: .88},
        {left: to.l + 'px', width: to.w + 'px', transform: 'scaleY(1)'},
      ], {duration: 620, easing: 'cubic-bezier(.45,0,.2,1)'});
    };
    place(true);
    const onResize = () => place(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [page]);
  return <span ref={ref} className="bnav-blob" aria-hidden="true"/>;
}
