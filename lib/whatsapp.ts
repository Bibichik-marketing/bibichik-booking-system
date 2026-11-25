export type ConfirmationBooking={status:string;phone:string;customer_name:string;outlet_id:string;reservation_date:string;reservation_time:string;guests:number;reference:string};
/** Conservative Malaysian mobile support: 011 + eight digits; other 01x + seven. */
export function normalizeMalaysianMobile(value:string):string|null {
 let phone=value.trim().replace(/[\s().-]/g,'');
 if(phone.startsWith('+'))phone=phone.slice(1);
 if(phone.startsWith('0'))phone=`60${phone.slice(1)}`;
 return /^(?:6011\d{8}|601[02-9]\d{7})$/.test(phone)?phone:null;
}
export function confirmationMessage(booking:ConfirmationBooking):string|null {
 const outlet=({'bibichik-ss2':'SS2','bibichik-sunway-163':'Sunway 163'} as Record<string,string>)[booking.outlet_id];
 if(!outlet||!/^\d{4}-\d{2}-\d{2}$/.test(booking.reservation_date)||!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(booking.reservation_time))return null;
 const instant=new Date(`${booking.reservation_date}T${booking.reservation_time.slice(0,5)}:00+08:00`);
 if(Number.isNaN(instant.getTime())||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant)!==booking.reservation_date)return null;
 const date=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'long',year:'numeric'}).format(instant);
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'numeric',minute:'2-digit',hour12:true}).format(instant);
 return `Hi ${booking.customer_name}! 💙\n\nThank you for choosing BiBiChik!\n\nYour table reservation has been confirmed.\n\n📍 Outlet: BiBiChik ${outlet}\n📅 Date: ${date}\n🕒 Time: ${time}\n👥 Guests: ${booking.guests} Pax\n🔖 Booking Reference: ${booking.reference}\n\nWe look forward to welcoming you!\n\nIf you need to make any changes to your reservation, please contact our team.\n\nSee you soon!\n\n— BiBiChik Team\nA Taste of Nyonya Heritage`;
}
export function whatsappConfirmationLink(booking:ConfirmationBooking):string|null {
 if(booking.status!=='Confirmed')return null;
 const phone=normalizeMalaysianMobile(booking.phone),message=confirmationMessage(booking);
 return phone&&message?`https://wa.me/${phone}?text=${encodeURIComponent(message)}`:null;
}

/** Prepared only for a successfully saved Rejected booking; staff sends manually. */
export function rejectionMessage(booking:ConfirmationBooking):string|null {
 if(!confirmationMessage(booking))return null;
 const outlet=booking.outlet_id==='bibichik-ss2'?'SS2':'Sunway 163';
 const date=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${booking.reservation_date}T${booking.reservation_time.slice(0,5)}:00+08:00`));
 return `Hi ${booking.customer_name},\n\nThank you for your interest in BiBiChik. We are sorry that we are unable to accept this reservation request.\n\nOutlet: BiBiChik ${outlet}\nBooking reference: ${booking.reference}\nDate: ${date}\nTime: ${booking.reservation_time.slice(0,5)} (Malaysia time)\n\nPlease contact us if you would like help finding another suitable date or time. We appreciate your understanding.\n\n— BiBiChik Team`;
}
export function whatsappRejectionLink(booking:ConfirmationBooking):string|null {
 if(booking.status!=='Rejected')return null;
 const phone=normalizeMalaysianMobile(booking.phone),message=rejectionMessage(booking);
 return phone&&message?`https://wa.me/${phone}?text=${encodeURIComponent(message)}`:null;
}
