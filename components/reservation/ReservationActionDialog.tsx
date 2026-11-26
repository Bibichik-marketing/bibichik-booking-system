"use client";
import {useId,useRef,useState} from 'react';
import {validRejectionReason,rejectionReasonLimit} from '@/lib/whatsapp';
type Props={booking:{customer_name:string;reference:string;reservation_date:string;reservation_time:string;outlet_id?:string};requireReason?:boolean;target:'Rejected'|'Cancelled';busy:boolean;error:string;t:(key:string)=>string;onConfirm:(reason?:string)=>Promise<boolean>;onBack:()=>void};
export default function ReservationActionDialog({booking,target,busy,error,t,onConfirm,onBack,requireReason=false}:Props){
 const titleId=useId(),descriptionId=useId(),submitting=useRef(false);
 const rejected=target==='Rejected';const [reason,setReason]=useState('');const valid=!rejected||(requireReason&&validRejectionReason(reason));
 function goBack(){if(!busy&&!submitting.current)onBack();}
 async function confirmAction(){if(busy||submitting.current||!valid)return;submitting.current=true;try{await onConfirm(rejected?reason:undefined);}finally{submitting.current=false;}}
 return <dialog className="reservation-action-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} ref={node=>{if(node&&!node.open)node.showModal()}} onCancel={event=>{event.preventDefault();goBack();}}>
  <h2 id={titleId}>{rejected?t('Reject reservation'):t('Cancel reservation')}</h2>
  <p id={descriptionId}>{rejected?t('This reservation will be rejected. Please check the booking details before continuing.'):t('This reservation will be cancelled. Please check the booking details before continuing.')}</p>
  <dl>{[[t('Guest'),booking.customer_name],[t('Reference'),booking.reference],[t('Outlet'),booking.outlet_id==='bibichik-ss2'?'BiBiChik SS2':booking.outlet_id==='bibichik-sunway-163'?'BiBiChik Sunway 163':'—'],[t('Date & time'),`${booking.reservation_date} · ${booking.reservation_time.slice(0,5)}`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  {rejected&&<label className="rejection-reason-field">{t('Reason for Rejection')}<textarea required rows={4} maxLength={rejectionReasonLimit} value={reason} disabled={busy} onChange={event=>setReason(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={descriptionId+'-reason'+(error?' '+descriptionId+'-error':'')}/><small id={descriptionId+'-reason'}>{t('This reason will be shared with the customer via WhatsApp. Do not include internal notes or staff details.')}</small></label>}
  {rejected&&!requireReason&&<p className="reserve-notice" role="status">{t('Rejection reasons are not available yet. The reviewed database update must be installed and enabled first.')}</p>}
  {error&&<p id={descriptionId+'-error'} className="reserve-notice" role="alert">{t(error)}</p>}
  <div className="reservation-action-buttons"><button type="button" autoFocus disabled={busy} onClick={goBack}>{t('Go Back')}</button><button type="button" disabled={busy||!valid} aria-busy={busy} onClick={()=>void confirmAction()}>{busy?t('Processing…'):rejected?t('Confirm Reject'):t('Confirm Cancellation')}</button></div>
 </dialog>;
}
