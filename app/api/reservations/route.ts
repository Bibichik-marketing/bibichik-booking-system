import {issueStatusToken,hashStatusToken} from '@/lib/status-token';
import { bookingRpc } from '@/lib/reservation-db';
import { reservationSchema } from '@/lib/reservations';
import { sameOrigin, readJson, allowSubmission } from '@/lib/http-security';
export async function POST(request:Request) {
 if(!sameOrigin(request)) return Response.json({error:'Forbidden'},{status:403});
 if(!allowSubmission(request)) return Response.json({error:'Rate limited'},{status:429});
 try {
 const parsed=reservationSchema.safeParse(await readJson(request));
 if(!parsed.success) return Response.json({error:'Invalid fields'},{status:400});
 const token=issueStatusToken();
 const booking=await bookingRpc('booking_create_v2',{payload:{...parsed.data,time:parsed.data.slotId},token_hash:hashStatusToken(token)});
 return Response.json({booking,statusToken:booking.replayed?undefined:token},{headers:{'Cache-Control':'no-store'}});
 } catch { return Response.json({error:'Reservation unavailable'},{status:503}); }
}
