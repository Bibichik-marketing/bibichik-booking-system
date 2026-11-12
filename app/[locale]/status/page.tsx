import {notFound} from 'next/navigation';
import BookingStatus from '@/components/reservation/BookingStatus';
import {statusCopy} from '@/lib/status-copy';
import '../reserve/reserve.css';
export const metadata={title:'BiBiChik | Booking status',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(!statusCopy[locale])notFound();return <BookingStatus locale={locale}/>}
