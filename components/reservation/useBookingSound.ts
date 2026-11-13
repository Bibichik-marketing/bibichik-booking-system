 'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createBookingAlerts,type AlertBooking} from '@/lib/booking-alerts';
export function useBookingSound(){
 const tracker=useRef(createBookingAlerts());const audio=useRef<AudioContext|null>(null);const enabled=useRef(false);const [active,setActive]=useState(false);const [notice,setNotice]=useState('');
 useEffect(()=>()=>{void audio.current?.close()},[]);
 const play=useCallback(()=>{const ctx=audio.current;if(!enabled.current||!ctx)return;if(ctx.state!=='running'){enabled.current=false;setActive(false);setNotice('Sound paused by browser. Enable sound again.');return}const osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=740;gain.gain.setValueAtTime(0.12,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);osc.start();osc.stop(ctx.currentTime+0.3)},[]);
 const observe=useCallback((rows:AlertBooking[],serverTime:number)=>{if(tracker.current.observe(rows,serverTime))play()},[play]);
 const reset=useCallback(()=>{tracker.current.reset();enabled.current=false;setActive(false)},[]);
 async function toggle(){if(enabled.current){enabled.current=false;setActive(false);return}try{audio.current??=new AudioContext();await audio.current.resume();if(audio.current.state!=='running')throw Error();enabled.current=true;setActive(true);setNotice('');play()}catch{setNotice('Sound unavailable. Keep checking the reservation list.')}}
 return {observe,reset,toggle,active,notice};
}
