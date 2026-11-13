 'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createBookingAlerts,type AlertBooking} from '@/lib/booking-alerts';
import {createBookingSound} from '@/lib/booking-sound';
export function useBookingSound(){
 const tracker=useRef(createBookingAlerts());const audio=useRef<ReturnType<typeof createBookingSound>|null>(null);const [active,setActive]=useState(false);const [notice,setNotice]=useState('');const [detected,setDetected]=useState(0);const activating=useRef(false);
 useEffect(()=>()=>{const old=audio.current;audio.current=null;void old?.close()},[]);
 const observe=useCallback((rows:AlertBooking[],serverTime:number)=>{
  if(!tracker.current.observe(rows,serverTime))return;
  setDetected(n=>n+1);const result=audio.current?.play()??'muted';
  if(result==='blocked'){setActive(false);setNotice('New booking detected, but browser audio is paused or blocked. Click Enable sound and listen for the test chime.')}
  else if(result==='playing')setNotice('New booking detected; chime scheduled. If silent, check tab mute, device output and volume.');
  else setNotice('New booking detected while sound was off.');
 },[]);
 const reset=useCallback(()=>{tracker.current.reset();audio.current?.mute();setActive(false);setDetected(0);setNotice('')},[]);
 async function test(){if(activating.current)return;activating.current=true;try{audio.current??=createBookingSound(()=>new AudioContext());const result=await audio.current.activate();setActive(result==='playing');setNotice(result==='playing'?'Test chime scheduled. Confirm you hear two notes; otherwise check tab mute, device output and volume.':'Browser audio could not start. Allow site sound, then click Enable sound again.')}finally{activating.current=false}}
 function toggle(){if(active){audio.current?.mute();setActive(false);setNotice('Sound muted. Muted bookings will not replay later.')}else void test()}
 return {observe,reset,toggle,test,active,notice,detected};
}
