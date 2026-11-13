export type StaffAuthCategory='missing_session'|'auth_configuration'|'api_key_rejected'|'session_rejected'|'membership_denied'|'auth_rejected'|'upstream_unavailable'|'invalid_auth_response';
const safeCodes=['invalid_credentials','email_not_confirmed','user_banned','over_request_rate_limit','bad_jwt','session_not_found','PGRST301','PGRST302','42501','P0001'];
export class StaffAuthError extends Error{
 constructor(public category:StaffAuthCategory,public status:number,public upstreamStatus?:number,public upstreamCode?:string){super(category);this.name='StaffAuthError'}
}
/** Project labels detect accidental mixing; Supabase still cryptographically verifies keys/JWTs. */
export function staffConfiguration(env:Record<string,string|undefined>){
 const url=env.SUPABASE_URL?.trim(),key=env.SUPABASE_ANON_KEY?.trim();
 if(!url||!key)throw new StaffAuthError('auth_configuration',503);
 let parsed:URL;try{parsed=new URL(url)}catch{throw new StaffAuthError('auth_configuration',503)}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new StaffAuthError('auth_configuration',503);
 const expected=env.SUPABASE_EXPECTED_PROJECT_REF?.trim();if(expected&&parsed.hostname!==expected+'.supabase.co')throw new StaffAuthError('auth_configuration',503);
 if(key.startsWith('eyJ')){try{const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());const project=parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];if(claims.role!=='anon'||project&&claims.ref!==project)throw Error()}catch{throw new StaffAuthError('auth_configuration',503)}}
 else if(!key.startsWith('sb_publishable_'))throw new StaffAuthError('auth_configuration',503);
 return {url:parsed.origin,key};
}
export async function staffRequest(path:string,token:string,body:unknown,env:Record<string,string|undefined>,fetcher:typeof fetch=fetch){
 const {url,key}=staffConfiguration(env);let response:Response;
 try{response=await fetcher(url+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(10000)})}catch{throw new StaffAuthError('upstream_unavailable',503)}
 if(!response.ok){
  let code='';let keyRejected=false;try{const data=await response.json();code=typeof data.code==='string'?data.code:'';keyRejected=data.message==='Invalid API key'||data.msg==='Invalid API key'}catch{}
  // Never retain or log upstream response text, user identifiers or request headers.
  const safeCode=safeCodes.includes(code)?code:undefined;
  if(keyRejected)throw new StaffAuthError('api_key_rejected',503,response.status,safeCode);
  if(response.status===429||response.status>=500)throw new StaffAuthError('upstream_unavailable',503,response.status,safeCode);
  if(path.startsWith('/auth/'))throw new StaffAuthError('auth_rejected',401,response.status,safeCode);
  if(response.status===401||code==='PGRST301'||code==='PGRST302')throw new StaffAuthError('session_rejected',401,response.status,safeCode);
  if(response.status===403||code==='42501'||code==='P0001')throw new StaffAuthError('membership_denied',403,response.status,safeCode);
  throw new StaffAuthError('upstream_unavailable',503,response.status,safeCode);
 }
 const text=await response.text();if(!text.trim())return null;
 try{return JSON.parse(text)}catch{throw new StaffAuthError('invalid_auth_response',503,response.status)}
}
export function validStaffSession(data:unknown):data is {access_token:string;expires_in:number}{
 if(!data||typeof data!=='object')return false;const s=data as Record<string,unknown>;
 return typeof s.access_token==='string'&&s.access_token.length>0&&typeof s.expires_in==='number'&&Number.isFinite(s.expires_in)&&s.expires_in>0;
}
export function staffFailure(error:unknown,stage:string){
 const known=error instanceof StaffAuthError;const category=known?error.category:stage==='login_input'?'invalid_request':'invalid_auth_response';const status=known?error.status:stage==='login_input'?400:503;
 const safeStage=['session_list','login_input','password_auth','staff_membership','session_cookie'].includes(stage)?stage:'request';
 const diagnostic={event:'staff_auth_failed',stage:safeStage,category,...(known&&error.upstreamStatus?{upstreamStatus:error.upstreamStatus}:{}),...(known&&error.upstreamCode&&safeCodes.includes(error.upstreamCode)?{code:error.upstreamCode}:{})};
 return {status,diagnostic,body:{error:status===400?'Invalid sign-in request':status===401?'Sign in required':status===403?'Staff access denied':'Staff service temporarily unavailable'}};
}
