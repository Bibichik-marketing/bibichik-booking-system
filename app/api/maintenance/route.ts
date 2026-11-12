import {timingSafeEqual} from 'node:crypto';
import {bookingRpc} from '@/lib/reservation-db';
export async function POST(request:Request){const expected=process.env.MAINTENANCE_SECRET;const actual=request.headers.get('authorization')||'';if(!expected||Buffer.byteLength(actual)!==Buffer.byteLength(`Bearer ${expected}`)||!timingSafeEqual(Buffer.from(actual),Buffer.from(`Bearer ${expected}`)))return new Response(null,{status:401});try{await bookingRpc('booking_expire_v2',{});return new Response(null,{status:204})}catch{return new Response(null,{status:503})}}
