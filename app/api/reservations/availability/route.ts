import {staffToken,supabaseRequest} from '@/lib/staff';
import { bookingRpc } from '@/lib/reservation-db';
import { selectionSchema } from '@/lib/reservations';
export async function GET(request:Request) {
 const parsed=selectionSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!parsed.success) return Response.json({slots:[]},{status:400});
 try { if(new URL(request.url).searchParams.get('channel')==='Phone'){const token=await staffToken();return Response.json({slots:await supabaseRequest('/rest/v1/rpc/staff_availability_v2',token,{outlet:parsed.data.outletId,day:parsed.data.date,party:parsed.data.guests})},{headers:{'Cache-Control':'no-store'}})}return Response.json({slots:await bookingRpc('reservation_availability',{outlet:parsed.data.outletId,day:parsed.data.date,party:parsed.data.guests})},{headers:{'Cache-Control':'no-store'}}); }
 catch { return Response.json({slots:[],unavailable:true},{headers:{'Cache-Control':'no-store'}}); }
}
