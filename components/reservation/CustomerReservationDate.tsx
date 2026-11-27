"use client";
import {CalendarDays} from 'lucide-react';
import {customerDateCopy} from '@/lib/reservation-copy';
export function customerDateValue(value:string,locale:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return customerDateCopy[locale]??customerDateCopy.en;
 const date=new Date(`${value}T12:00:00+08:00`);
 if(!Number.isFinite(date.getTime()))return customerDateCopy[locale]??customerDateCopy.en;
 return new Intl.DateTimeFormat(({en:'en-MY',zh:'zh-CN',ms:'ms-MY',ko:'ko-KR',ja:'ja-JP'} as Record<string,string>)[locale]??'en-MY',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(date);
}
/** Keep the real date input as the touch target; do not rely on WebKit's intrinsic value renderer. */
export default function CustomerReservationDate({value,min,locale,onChange}:{value:string;min:string;locale:string;onChange:(value:string)=>void}){
 return <span className="customer-date-control">
  <span className="customer-date-display" aria-hidden="true"><span id={!value?'customer-reservation-date-hint':undefined}>{customerDateValue(value,locale)}</span><CalendarDays size={16}/></span>
  <input type="date" required min={min} value={value} placeholder={customerDateCopy[locale]} aria-describedby={!value?'customer-reservation-date-hint':undefined} onChange={event=>onChange(event.target.value)} onClick={event=>{try{event.currentTarget.showPicker?.()}catch{/* Native tap/focus remains available on Safari versions without showPicker. */}}}/>
 </span>;
}
