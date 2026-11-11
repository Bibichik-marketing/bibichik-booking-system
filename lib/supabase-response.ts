/** PostgREST void RPCs can return an empty successful body. */
export async function parseSupabaseResponse(response:Response){
 if(!response.ok)throw Error('Access denied');
 const text=await response.text();
 return text.trim()?JSON.parse(text):null;
}
