export type AlertBooking={id:string;status:string;source?:string;created_at?:string};
/** In-memory, per authenticated session. Initial snapshot never alerts. */
export function createBookingAlerts(){
 let since:number|null=null;const seen=new Set<string>();
 return {reset(){since=null;seen.clear()},observe(rows:AlertBooking[],serverTime:number){
  const fresh=since!==null&&rows.some(r=>!seen.has(r.id)&&r.status==='Pending'&&r.source==='Online'&&Number.isFinite(Date.parse(r.created_at??''))&&Date.parse(r.created_at!)>since!);
  rows.forEach(r=>seen.add(r.id));if(since===null)since=serverTime;
  return fresh;
 }};
}
