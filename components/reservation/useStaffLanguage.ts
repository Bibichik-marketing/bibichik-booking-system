 'use client';
import {useSyncExternalStore} from 'react';
import {createStaffLanguageStore} from '@/lib/staff-language-store';
const store=createStaffLanguageStore(()=>typeof window==='undefined'?null:window.localStorage,()=>window.dispatchEvent(new Event('bibichik-language')));
function subscribe(notify:()=>void){window.addEventListener('storage',notify);window.addEventListener('bibichik-language',notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener('bibichik-language',notify)}}
export function useStaffLanguage(){const language=useSyncExternalStore(subscribe,store.get,()=> 'en' as const);return {language,setLanguage:store.set}}
