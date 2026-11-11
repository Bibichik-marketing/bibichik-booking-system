import { cookies } from 'next/headers';
export async function supabaseRequest(path:string,token:string,body?:unknown) {
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw Error('Not configured');
 const r=await fetch(`${url}${path}`,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:`Bearer ${token||key}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Access denied');return r.json();
}
export async function staffToken(){const token=(await cookies()).get('bbc_staff')?.value;if(!token)throw Error('Sign in required');return token;}
