/** Privacy-compatible fallback for the existing firstName API field. Full name remains in name. */
export function bookingDisplayName(fullName:string){
 const first=fullName.trim().split(/\s+/u)[0]??'';
 const candidate=/^[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(first)?Array.from(first)[0]??'':first;
 let display='';for(const character of candidate){if(display.length+character.length>60)break;display+=character;}
 return display;
}
