import { useEffect, useRef, useState } from 'react';

// Pointer-based mouse/touch/pen drag. Only event chips/handles own
// touch gestures: the rest of the calendar retains ordinary page scrolling.
export default function useCalendarDrag(onMove) {
  const current = useRef(null), move = useRef(onMove), suppressedUntil = useRef(0);
  const [drag, setDrag] = useState(null), [over, setOver] = useState(null);
  move.current = onMove;
  const targetDay = (x,y) => document.elementFromPoint(x,y)?.closest('[data-calendar-date]')?.dataset.calendarDate || null;
  const clear = () => { current.current = null; setDrag(null); setOver(null); };
  useEffect(() => {
    let frame;
    const update = () => {
      const active = current.current;
      if (active?.pointer && active.moved) {
        const edge = 65, height = window.innerHeight;
        const speed = active.y < edge ? -12 : active.y > height-edge ? 12 : 0;
        if (speed) { window.scrollBy({top:speed,left:0,behavior:'instant'}); setOver(targetDay(active.x,active.y)); }
      }
      frame = active?.pointer && active.moved ? requestAnimationFrame(update) : null;
    };
    const pointerMove = event => {
      const active = current.current;
      if (!active?.pointer || event.pointerId !== active.pointerId) return;
      active.x = event.clientX; active.y = event.clientY;
      if (!active.moved && Math.hypot(active.x-active.startX,active.y-active.startY)<7) return;
      active.moved = true; event.preventDefault();
      if (!frame) frame=requestAnimationFrame(update);
      setDrag({title:active.title,x:active.x,y:active.y});
      setOver(targetDay(active.x,active.y));
    };
    const pointerUp = event => {
      const active = current.current;
      if (!active?.pointer || event.pointerId !== active.pointerId) return;
      const to = targetDay(event.clientX,event.clientY);
      clear();
      if (active.moved) {
        suppressedUntil.current = performance.now()+500;
        if (event.type !== 'pointercancel' && to) move.current(active.id,active.from,to);
      }
    };
    const cancel = event => { if (!event || event.type === 'blur' || event.key === 'Escape') { if (current.current) suppressedUntil.current=performance.now()+500; clear(); } };
    document.addEventListener('pointermove',pointerMove,{passive:false});
    document.addEventListener('pointerup',pointerUp);
    document.addEventListener('pointercancel',pointerUp);
    document.addEventListener('keydown',cancel);
    window.addEventListener('blur',cancel);
    return () => {
      cancelAnimationFrame(frame); current.current=null;
      document.removeEventListener('pointermove',pointerMove);
      document.removeEventListener('pointerup',pointerUp);
      document.removeEventListener('pointercancel',pointerUp);
      document.removeEventListener('keydown',cancel);
      window.removeEventListener('blur',cancel);
    };
  },[]);
  const props = (event, from) => event.source === 'taskflow' ? {} : {
    draggable: false,
    onPointerDown: e => {
      if (e.button !== 0 || current.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      current.current={id:event.id,title:event.title,from,pointer:true,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY};
    },
    onClickCapture: e => { if (performance.now()<suppressedUntil.current) { e.preventDefault(); e.stopPropagation(); } },
  };
  const cellProps = date => ({
    'data-calendar-date':date,
  });
  return {drag,over,props,cellProps};
}
