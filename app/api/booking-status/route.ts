import {z} from 'zod';
import {bookingRpc} from '@/lib/reservation-db';
import {hashStatusToken} from '@/lib/status-token';
import {readJson,sameOrigin,allowSubmission} from '@/lib/http-security';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
export async function POST(request:Request){
 if(!sameOrigin(request)||!allowSubmission(request))return Response.json({booking:null},{status:429,headers});
 try{const {token}=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).parse(await readJson(request));const booking=await bookingRpc('booking_status_v2',{token_hash:hashStatusToken(token)});return Response.json({booking},{headers});}catch{return Response.json({booking:null},{headers})}
}
