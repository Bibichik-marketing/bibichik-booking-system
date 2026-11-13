"use client";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {customerLocale,customerLanguageUrl} from '@/lib/customer-language';
import {reservationCopy} from '@/lib/reservation-copy';
import {statusCopy} from '@/lib/status-copy';
export function useCustomerLocale(initialLocale:string,embedded=false){
 const pathname=usePathname();const locale=embedded?initialLocale:customerLocale(pathname,initialLocale);
 useEffect(()=>{if(embedded)return;document.documentElement.lang=locale;document.title=`${pathname?.includes('/status')?statusCopy[locale][0]:reservationCopy[locale][0]} | BiBiChik Nyonya Restaurant`;},[locale,embedded,pathname]);
 function switchLocale(next:string){if(!embedded)window.history.replaceState(null,'',customerLanguageUrl(window.location.href,next));}
 return {locale,switchLocale};
}
