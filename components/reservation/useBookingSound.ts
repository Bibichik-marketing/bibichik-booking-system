 'use client';
import {useCallback,useEffect,useRef} from 'react';
import {createBookingAlerts,type AlertBooking} from '@/lib/booking-alerts';
import {createBookingSound} from '@/lib/booking-sound';
export function useBookingSound(){
 const tracker=useRef(createBookingAlerts());const audio=useRef<ReturnType<typeof createBookingSound>|null>(null);const authenticated=useRef(false);
 const unlock=useCallback(()=>{audio.current??=createBookingSound(()=>new AudioContext());void audio.current.unlock()},[]);
 useEffect(()=>{
  const visible=()=>{if(document.visibilityState==='visible')unlock()};
  document.addEventListener('pointerdown',unlock,{capture:true,passive:true});document.addEventListener('keydown',unlock,true);window.addEventListener('focus',unlock);window.addEventListener('pageshow',visible);document.addEventListener('visibilitychange',visible);
  return()=>{document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);window.removeEventListener('focus',unlock);window.removeEventListener('pageshow',visible);document.removeEventListener('visibilitychange',visible);const old=audio.current;audio.current=null;void old?.close()};
 },[unlock]);
 const setAuthenticated=useCallback((value:boolean)=>{authenticated.current=value;if(value)unlock();else{tracker.current.reset();audio.current?.mute()}},[unlock]);
 const observe=useCallback((rows:AlertBooking[],serverTime:number)=>{
  // Consume each observation once even if autoplay is blocked: no delayed/repeated replay.
  if(tracker.current.observe(rows,serverTime)&&authenticated.current){const result=audio.current?.play();if(result!=='playing')unlock()}
 },[unlock]);
 const reset=useCallback(()=>{authenticated.current=false;tracker.current.reset();audio.current?.mute()},[]);
 return {observe,reset,setAuthenticated};
}
