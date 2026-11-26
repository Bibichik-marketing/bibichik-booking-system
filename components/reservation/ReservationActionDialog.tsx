"use client";
import {useId,useRef} from 'react';
type Props={booking:{customer_name:string;reference:string;reservation_date:string;reservation_time:string};target:'Rejected'|'Cancelled';busy:boolean;error:string;t:(key:string)=>string;onConfirm:()=>Promise<boolean>;onBack:()=>void};
export default function ReservationActionDialog({booking,target,busy,error,t,onConfirm,onBack}:Props){
 const titleId=useId(),descriptionId=useId(),submitting=useRef(false);
 const rejected=target==='Rejected';
 function goBack(){if(!busy&&!submitting.current)onBack();}
 async function confirmAction(){if(busy||submitting.current)return;submitting.current=true;try{await onConfirm();}finally{submitting.current=false;}}
 return <dialog className="reservation-action-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} ref={node=>{if(node&&!node.open)node.showModal()}} onCancel={event=>{event.preventDefault();goBack();}}>
  <h2 id={titleId}>{rejected?t('Reject reservation'):t('Cancel reservation')}</h2>
  <p id={descriptionId}>{rejected?t('This reservation will be rejected. Please check the booking details before continuing.'):t('This reservation will be cancelled. Please check the booking details before continuing.')}</p>
  <dl>{[[t('Guest'),booking.customer_name],[t('Reference'),booking.reference],[t('Date & time'),`${booking.reservation_date} · ${booking.reservation_time.slice(0,5)}`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  {error&&<p className="reserve-notice" role="alert">{t(error)}</p>}
  <div className="reservation-action-buttons"><button type="button" autoFocus disabled={busy} onClick={goBack}>{t('Go Back')}</button><button type="button" disabled={busy} aria-busy={busy} onClick={()=>void confirmAction()}>{busy?t('Processing…'):rejected?t('Confirm Reject'):t('Confirm Cancellation')}</button></div>
 </dialog>;
}
