import {createContext,useContext,useMemo,useState,useLayoutEffect} from 'react';

const Views=createContext(null);
export function ViewStateProvider({owner,children}){
  const store=useMemo(()=>new Map(),[owner]);
  return <Views.Provider value={store}>{children}</Views.Provider>;
}
// Keep view preferences in memory across route changes, never across accounts.
export function useViewState(key,initial){
  const store=useContext(Views);
  const [value,setValue]=useState(()=>store?.has(key)?store.get(key):typeof initial==='function'?initial():initial);
  const change=next=>setValue(old=>{const value=typeof next==='function'?next(old):next;store?.set(key,value);return value;});
  return [value,change];
}
export function PageFrame({top,mainRef,children}){
  useLayoutEffect(()=>{window.scrollTo({top,behavior:'instant'});mainRef.current?.focus({preventScroll:true});},[]);
  return children;
}
export function useScrollMemory(ref,key,initial=0){
  const store=useContext(Views);
  useLayoutEffect(()=>{const element=ref.current;if(!element)return;element.scrollTop=store?.get(key)??initial;return()=>store?.set(key,element.scrollTop);},[store,key]);
}
export function SectionNav({label,items,current}){
  return <nav className="section-tabs" aria-label={label}>{items.map(([key,title])=><a key={key} href={'#/'+key} aria-current={key===current?'page':undefined}>{title}</a>)}</nav>;
}
export const PlanningNav=({current})=><SectionNav label="Planning" current={current} items={[["calendar","Calendar"],["planner","Daily planner"]]}/>;
export const DataNav=({current})=><SectionNav label="Data & connections" current={current} items={[["integrations","Connections"],["backups","Backup & restore"]]}/>;
