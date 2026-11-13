"use client";
import {useEffect,useRef} from 'react';
import {Globe,ChevronDown,Check} from 'lucide-react';
import {customerLanguages} from '@/lib/customer-language';
export default function CustomerLanguageSelector({locale,onSelect}:{locale:string;onSelect:(locale:string)=>void}){
 const container=useRef<HTMLDetailsElement>(null);const summary=useRef<HTMLElement>(null);
 const current=customerLanguages.find(l=>l.code===locale)??customerLanguages[0];
 useEffect(()=>{function close(event:PointerEvent){if(event.target instanceof Node&&!container.current?.contains(event.target)&&container.current)container.current.open=false;}document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 return <details className="customer-language" ref={container} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))event.currentTarget.open=false;}} onKeyDown={event=>{
  if(event.key==='Escape'){event.preventDefault();event.currentTarget.open=false;summary.current?.focus();}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.currentTarget.open=true;const options=Array.from(event.currentTarget.querySelectorAll('button'));const index=options.indexOf(document.activeElement as HTMLButtonElement);const next=event.key==='Home'?0:event.key==='End'?options.length-1:index<0?customerLanguages.indexOf(current):(index+(event.key==='ArrowUp'?-1:1)+options.length)%options.length;options[next]?.focus();}
 }}>
 <summary ref={summary} aria-label={`${current.label}: ${current.name}`}><Globe size={16} aria-hidden="true"/><span className="customer-language-full">{current.name}</span><span className="customer-language-short" aria-hidden="true">{current.short}</span><ChevronDown size={14} aria-hidden="true"/></summary>
 <ul className="customer-language-options" aria-label={current.label}>{customerLanguages.map(language=><li key={language.code}><button type="button" lang={language.code} aria-current={locale===language.code?'true':undefined} onClick={()=>{onSelect(language.code);if(container.current)container.current.open=false;summary.current?.focus();}}><span>{language.name}</span><span className="customer-language-check" aria-hidden="true">{locale===language.code&&<Check size={16}/>}</span></button></li>)}</ul>
 </details>;
}
