import type {AlertBooking} from './booking-alerts';
export type AlertState={pending:Record<string,number>;acknowledged:Record<string,number>;lastSound:number};
export const emptyAlerts=():AlertState=>({pending:{},acknowledged:{},lastSound:0});
/** Persist only opaque IDs/times; never guest details, credentials or booking content. */
export function reconcileAlerts(state:AlertState,rows:AlertBooking[],fresh:string[],now:number):AlertState{
 const eligible=new Set(rows.filter(r=>r.status==='Pending'&&r.source==='Online').map(r=>r.id));
 const acknowledged=Object.fromEntries(Object.entries(state.acknowledged).filter(([,at])=>now-at<86400000));
 const pending=Object.fromEntries(Object.entries(state.pending).filter(([id,at])=>eligible.has(id)&&now-at<86400000));
 for(const id of fresh)if(eligible.has(id)&&!acknowledged[id])pending[id]??=now;
 return {pending,acknowledged,lastSound:state.lastSound};
}
export function acknowledgeAlerts(state:AlertState,now:number):AlertState{return {...state,pending:{},acknowledged:{...state.acknowledged,...Object.fromEntries(Object.keys(state.pending).map(id=>[id,now]))}}}
export function alertSoundDue(state:AlertState,now:number){return Object.keys(state.pending).length>0&&now-state.lastSound>=15000}
