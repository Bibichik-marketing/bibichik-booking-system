 'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {AlertBooking} from '@/lib/booking-alerts';
import {createBookingSound} from '@/lib/booking-sound';
import {emptyAlerts,reconcileAlerts,acknowledgeAlerts,alertSoundDue,type AlertState} from '@/lib/booking-alert-queue';
const key='bbc-incoming-bookings-v1';
export function useBookingSound(){
 const audio=useRef<ReturnType<typeof createBookingSound>|null>(null),authenticated=useRef(false),rows=useRef<AlertBooking[]>([]),since=useRef<number|null>(null),seen=useRef(new Set<string>()),fresh=useRef<string[]>([]),fallback=useRef(emptyAlerts());
 const [pendingCount,setPendingCount]=useState(0),[blocked,setBlocked]=useState(false);
 const unlock=useCallback(()=>{try{audio.current??=createBookingSound(()=>new AudioContext());void audio.current.unlock().then(result=>setBlocked(result!=='playing'))}catch{setBlocked(true)}},[]);
 const sync=useCallback(async(ack=false)=>{
  if(!authenticated.current)return;
  // Web Locks serializes read/modify/write across tabs. Without it, fail closed to visual alerts.
  const visualFallback=()=>{fallback.current=reconcileAlerts(fallback.current,rows.current,fresh.current,Date.now());fresh.current=[];if(ack)fallback.current=acknowledgeAlerts(fallback.current,Date.now());setBlocked(true);setPendingCount(Object.keys(fallback.current.pending).length)};
  if(!navigator.locks){visualFallback();return;}
  await navigator.locks.request(key,()=>{
   if(!authenticated.current)return;
   try{
    const raw=localStorage.getItem(key);let state:AlertState=raw?JSON.parse(raw):emptyAlerts();
    if(!state.pending||!state.acknowledged||!Number.isFinite(state.lastSound))state=emptyAlerts();
    state=reconcileAlerts(state,rows.current,fresh.current,Date.now());fresh.current=[];
    // Never remove another outlet's IDs just because this user's RPC cannot see them.
    const original:AlertState=raw?JSON.parse(raw):emptyAlerts();
    for(const [id,at] of Object.entries(original.pending??{}))if(!seen.current.has(id)&&Date.now()-at<86400000)state.pending[id]=at;
    const visible=Object.fromEntries(Object.entries(state.pending).filter(([id])=>rows.current.some(r=>r.id===id&&r.status==='Pending')));
    let own={...state,pending:visible};
    if(ack){own=acknowledgeAlerts(own,Date.now());for(const id of Object.keys(visible))delete state.pending[id];state.acknowledged=own.acknowledged;}
    setPendingCount(Object.keys(own.pending).length);
    if(!ack&&document.visibilityState==='visible'&&alertSoundDue(own,Date.now())){
     const result=audio.current?.play();setBlocked(result!=='playing');if(result==='playing')state.lastSound=Date.now();
    }
    fallback.current=own;localStorage.setItem(key,JSON.stringify(state));
   }catch{visualFallback()}
  }).catch(()=>visualFallback());
 },[]);
 useEffect(()=>{
  const visible=()=>{if(document.visibilityState==='visible'){unlock();void sync()}};
  document.addEventListener('pointerdown',unlock,{capture:true,passive:true});document.addEventListener('keydown',unlock,true);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  const timer=setInterval(()=>void sync(),1000);const storage=(event:StorageEvent)=>{if(event.key===key)void sync()};window.addEventListener('storage',storage);
  return()=>{clearInterval(timer);window.removeEventListener('storage',storage);document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);const old=audio.current;audio.current=null;void old?.close()};
 },[unlock,sync]);
 const reset=useCallback(()=>{authenticated.current=false;since.current=null;seen.current.clear();fresh.current=[];rows.current=[];fallback.current=emptyAlerts();setPendingCount(0);audio.current?.mute()},[]);
 const setAuthenticated=useCallback((value:boolean)=>{authenticated.current=value;if(value){unlock();void sync()}else reset()},[unlock,sync,reset]);
 const observe=useCallback((next:AlertBooking[],serverTime:number)=>{
  for(const row of next)if(since.current!==null&&!seen.current.has(row.id)&&row.status==='Pending'&&row.source==='Online'&&Date.parse(row.created_at??'')>since.current)fresh.current.push(row.id);
  next.forEach(row=>seen.current.add(row.id));since.current??=serverTime;rows.current=next;void sync();
 },[sync]);
 return {observe,reset,setAuthenticated,pendingCount,blocked,enableSound:unlock,acknowledge:()=>void sync(true)};
}
