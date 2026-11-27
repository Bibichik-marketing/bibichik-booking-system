"use client";
import {useState,type InputHTMLAttributes} from 'react';
import {CalendarDays} from 'lucide-react';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'defaultValue'|'value'> & {type?:'date'|'time'|'datetime-local';value?:string;defaultValue?:string};
export function staffDateValue(value:string,type='date'){
 if(type==='time')return value;
 const [date,time]=value.split('T'),parts=date.split('-');
 return parts.length===3?`${parts[2]}/${parts[1]}/${parts[0]}${time?' · '+time:''}`:value;
}
/** Native input remains the complete hit target and the source for FormData/validation. */
export default function StaffDateInput({type='date',value,defaultValue='',placeholder='Select a date',onChange,onClick,...props}:Props){
 const [draft,setDraft]=useState(defaultValue);const selected=value??draft;
 return <span className="staff-native-date"><span className="staff-native-date-display" aria-hidden="true"><span>{selected?staffDateValue(selected,type):placeholder}</span><CalendarDays size={16}/></span><input {...props} type={type} value={selected} placeholder={placeholder} onChange={event=>{if(value===undefined)setDraft(event.target.value);onChange?.(event)}} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)try{event.currentTarget.focus();event.currentTarget.showPicker?.()}catch{/* Native Safari tap/focus is still available. */}}}/></span>;
}
