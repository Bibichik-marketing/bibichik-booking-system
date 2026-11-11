import { notFound } from 'next/navigation';
import Reservation from '@/components/reservation/Reservation';
import { locales,reservationCopy } from '@/lib/reservation-copy';
import './reserve.css';
export async function generateMetadata({params}:{params:Promise<{locale:string}>}) {const {locale}=await params;if(!reservationCopy[locale])notFound();const base=process.env.SITE_URL || 'http://localhost:3000';return {title:`${reservationCopy[locale][0]} | BiBiChik Nyonya Restaurant`,description:reservationCopy[locale][1],alternates:{canonical:`${base}/${locale}/reserve`,languages:Object.fromEntries(locales.map(l=>[l,`${base}/${l}/reserve`]))}};}
export default async function Page({params}:{params:Promise<{locale:string}>}) {const {locale}=await params;if(!reservationCopy[locale])notFound();return <Reservation locale={locale}/>}
