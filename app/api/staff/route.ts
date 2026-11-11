import { cookies } from 'next/headers';
import { z } from 'zod';
import { sameOrigin,readJson,allowSubmission } from '@/lib/http-security';
import { staffToken,supabaseRequest } from '@/lib/staff';
export async function GET(){try{const token=await staffToken();const data=await supabaseRequest('/rest/v1/rpc/staff_reservations',token,{});return Response.json(data,{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Sign in required'},{status:401})}}
export async function POST(request:Request){
 if(!sameOrigin(request)||!allowSubmission(request))return Response.json({error:'Request denied'},{status:403});
 try{const raw=await readJson(request);const action=z.object({action:z.enum(['login','logout','status','manual'])}).passthrough().parse(raw);const jar=await cookies();
 if(action.action==='logout'){jar.delete('bbc_staff');return Response.json({ok:true})}
 if(action.action==='login'){const input=z.object({email:z.string().email(),password:z.string().min(1).max(200)}).parse(raw);const data=await supabaseRequest('/auth/v1/token?grant_type=password','',input);await supabaseRequest('/rest/v1/rpc/staff_reservations',data.access_token,{});jar.set('bbc_staff',data.access_token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:Math.min(data.expires_in,3600)});return Response.json({ok:true})}
 const token=await staffToken();
 if(action.action==='status'){const p=z.object({id:z.string().uuid(),status:z.enum(['Confirmed','Declined','Seated','Completed','Cancelled','No-show']),expected:z.string()}).parse(raw);await supabaseRequest('/rest/v1/rpc/staff_set_status',token,{booking_id:p.id,next_status:p.status,expected_status:p.expected});return Response.json({ok:true})}
 const {reservationSchema}=await import('@/lib/reservations');const input=z.object({payload:reservationSchema,source:z.enum(['Phone','Walk-in'])}).parse(raw);const booking=await supabaseRequest('/rest/v1/rpc/staff_manual_reservation',token,{payload:input.payload,source:input.source});return Response.json({booking});
 }catch{return Response.json({error:'Request failed. Check your access and booking details.'},{status:400})}
}
