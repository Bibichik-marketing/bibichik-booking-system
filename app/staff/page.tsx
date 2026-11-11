import Staff from '@/components/reservation/Staff';
import '../[locale]/reserve/reserve.css';
export const metadata={title:'Staff | BiBiChik Reservations',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{demo?:string}>}){const demo=process.env.NODE_ENV==='development'&&(await searchParams).demo==='1';return <Staff demo={demo}/>}
