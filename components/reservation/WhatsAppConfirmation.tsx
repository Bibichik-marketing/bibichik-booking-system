import {MessageCircle} from 'lucide-react';
import {normalizeMalaysianMobile,whatsappConfirmationLink,type ConfirmationBooking} from '@/lib/whatsapp';
const identity=(key:string)=>key;
export default function WhatsAppConfirmation({booking,demo=false,t=identity}:{t?:(key:string)=>string;booking:ConfirmationBooking;demo?:boolean}){
 if(booking.status!=='Confirmed')return null;
 const link=whatsappConfirmationLink(booking);
 const warning=demo?'WhatsApp is disabled for fictional demo bookings.':!normalizeMalaysianMobile(booking.phone)?'A valid Malaysian mobile number is required. Verify the guest’s contact details before using WhatsApp.':!link?'Check the reservation date, time and outlet before using WhatsApp.':null;
 return <div className="whatsapp-confirmation">{warning?<><button className="whatsapp-button" disabled aria-describedby="whatsapp-help"><MessageCircle size={18}/>{t("Send WhatsApp Confirmation")}</button><p id="whatsapp-help" role="status">{t(warning)}</p></>:<><a className="whatsapp-button" href={link!} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><MessageCircle size={18}/>{t("Send WhatsApp Confirmation")}</a><p>{t("Opens WhatsApp in a new tab. Review the message and press Send manually. Opening it does not confirm delivery.")}</p></>}</div>;
}
