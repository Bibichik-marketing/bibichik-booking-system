import {supabaseRequest} from '@/lib/staff';
import {bookingRpc} from '@/lib/reservation-db';
export async function GET(){try{if(!process.env.SUPABASE_URL||!process.env.SUPABASE_ANON_KEY||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SITE_URL)throw Error();await supabaseRequest('/auth/v1/settings','');if(await bookingRpc('booking_health_v2',{})!==true)throw Error();return Response.json({ready:true},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({ready:false},{status:503,headers:{'Cache-Control':'no-store'}})}}
