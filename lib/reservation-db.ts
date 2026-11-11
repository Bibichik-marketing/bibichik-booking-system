export async function bookingRpc(name:string,args:unknown) {
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url || !key) throw new Error('UNCONFIGURED');
 const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok) throw new Error('UNAVAILABLE');
 return response.json();
}
