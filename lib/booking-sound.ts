export type SoundResult='playing'|'blocked'|'muted';
/** Browser audio activation must originate in a click, never a polling timer. */
export function createBookingSound(factory:()=>AudioContext){
 let context:AudioContext|null=null;let enabled=false;
 function chime(ctx:AudioContext){
  // Schedule before awaiting resume: preserve the click gesture on Safari too.
  for(const [offset,frequency] of [[0,740],[0.24,988]]){
   const oscillator=ctx.createOscillator(),gain=ctx.createGain();const start=ctx.currentTime+0.03+offset;
   oscillator.connect(gain);gain.connect(ctx.destination);oscillator.frequency.value=frequency;
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(0.25,start+0.02);gain.gain.exponentialRampToValueAtTime(0.001,start+0.23);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};oscillator.start(start);oscillator.stop(start+0.24);
  }
 }
 return {
  async activate():Promise<SoundResult>{
   enabled=false;
   async function discard(){const old=context;context=null;try{await old?.close()}catch{}}
   try{if(!context||context.state==='closed')context=factory();const ctx=context;chime(ctx);await ctx.resume();if(ctx.state!=='running'){await discard();return 'blocked'}enabled=true;return 'playing'}catch{await discard();return 'blocked'}
  },
  play():SoundResult{if(!enabled)return 'muted';try{if(!context||context.state!=='running'){enabled=false;return 'blocked'}chime(context);return 'playing'}catch{enabled=false;return 'blocked'}},
  mute(){enabled=false},
  async close(){enabled=false;const old=context;context=null;try{await old?.close()}catch{/* No customer data or browser error strings logged. */}},
 };
}
