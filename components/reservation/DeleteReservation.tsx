"use client";
type Props={canArchive:boolean;booking:{reference:string;status:string;row_version?:number;archive_eligible?:boolean};busy:boolean;t:(key:string)=>string;onArchive:()=>void};
export default function DeleteReservation({canArchive,booking,busy,t,onArchive}:Props){
 if(!canArchive||booking.archive_eligible===false||!['Completed','Cancelled','Rejected','Expired','No-show'].includes(booking.status))return null;
 return <button disabled={busy||!booking.row_version} onClick={()=>{if(confirm(`${t("Delete reservation")} ${booking.reference}?\n${t("This archives the reservation and preserves its audit history. Capacity commitments remain unchanged.")}`))onArchive()}}>{t("Delete")}</button>;
}
