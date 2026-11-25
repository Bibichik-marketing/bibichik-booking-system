import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {StaffAuthError,validStaffSession} from './staff-auth';
type CookieOptions={httpOnly:true;secure:boolean;sameSite:'strict';path:string;maxAge?:number};
type Jar={get:(name:string)=>{value:string}|undefined;set:(name:string,value:string,options:CookieOptions)=>unknown;delete:(name:string)=>unknown};
type Session={access_token:string;refresh_token:string;expires_in:number;user:{id:string}};
type Saved={refresh:string;user:string;until:number;remember:boolean};
type Requester=(path:string,token:string,body?:unknown)=>Promise<unknown>;
const refreshes=new Map<string,Promise<unknown>>();
export const persistentSessionSeconds=30*24*60*60;
const browserSessionSeconds=12*60*60;
export function createStaffSession({jar,request,secret,production,now=Date.now}:{jar:Jar;request:Requester;secret:string|undefined;production:boolean;now?:()=>number}){
 const options:CookieOptions={httpOnly:true,secure:production,sameSite:'strict',path:'/'};
 function key(){if(!secret||secret.length<32)throw new StaffAuthError('auth_configuration',503);return createHash('sha256').update('bbc.staff.refresh.v1\0'+secret).digest();}
 function seal(saved:Saved){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);return Buffer.concat([iv,cipher.update(JSON.stringify(saved),'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64url');}
 function clear(){jar.delete('bbc_staff');jar.delete('bbc_staff_refresh');}
 function open(value:string):Saved{
  try{if(value.length>3800)throw Error();const bytes=Buffer.from(value,'base64url');const cipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(-16));const s=JSON.parse(Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]).toString());if(typeof s.refresh!=='string'||!s.refresh||typeof s.user!=='string'||typeof s.remember!=='boolean'||!Number.isFinite(s.until)||s.until<=now())throw Error();return s;}
  catch(error){if(error instanceof StaffAuthError)throw error;throw new StaffAuthError('session_rejected',401);}
 }
 function session(data:unknown):Session{if(!validStaffSession(data))throw new StaffAuthError('invalid_auth_response',503);const d=data as Session;if(typeof d.refresh_token!=='string'||!d.refresh_token||d.refresh_token.length>2000||!d.user||typeof d.user.id!=='string'||!d.user.id)throw new StaffAuthError('invalid_auth_response',503);return d;}
 function write(data:Session,saved:Saved){
  const remaining=Math.floor((saved.until-now())/1000);if(remaining<=0)throw new StaffAuthError('session_rejected',401);
  const encrypted=seal({...saved,refresh:data.refresh_token});if(encrypted.length>3800)throw new StaffAuthError('invalid_auth_response',503);
  jar.set('bbc_staff',data.access_token,{...options,...(saved.remember?{maxAge:Math.min(Math.floor(data.expires_in),remaining)}:{})});
  jar.set('bbc_staff_refresh',encrypted,{...options,...(saved.remember?{maxAge:remaining}:{})});
 }
 function save(data:unknown,remember:boolean){const d=session(data);write(d,{refresh:d.refresh_token,user:d.user.id,remember,until:now()+(remember?persistentSessionSeconds:browserSessionSeconds)*1000});}
 function expires(token:string){try{const exp=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).exp;return typeof exp==='number'&&Number.isFinite(exp)?exp*1000:0;}catch{return 0;}}
 async function renew(saved:Saved){
  const id=createHash('sha256').update(secret??'').update(saved.refresh).digest('hex');let pending=refreshes.get(id);
  if(!pending){if(refreshes.size>=200)throw new StaffAuthError('upstream_unavailable',503);pending=request('/auth/v1/token?grant_type=refresh_token','',{refresh_token:saved.refresh});refreshes.set(id,pending);}
  try{const d=session(await pending);if(d.user.id!==saved.user)throw new StaffAuthError('session_rejected',401);write(d,saved);return d.access_token;}finally{if(refreshes.get(id)===pending)refreshes.delete(id);}
 }
 async function token(){
  try{
   const encoded=jar.get('bbc_staff_refresh')?.value,saved=encoded?open(encoded):undefined;let access=jar.get('bbc_staff')?.value;let refreshed=false;
   if(saved&&(!access||expires(access)<=now()+60000)){access=await renew(saved);refreshed=true;}
   if(!access)throw new StaffAuthError('missing_session',401);
   let user:unknown;
   try{user=await request('/auth/v1/user',access);}catch(error){if(error instanceof StaffAuthError&&error.status===401&&saved&&!refreshed){access=await renew(saved);user=await request('/auth/v1/user',access);}else throw error;}
   if(!user||typeof user!=='object'||typeof (user as {id?:unknown}).id!=='string')throw new StaffAuthError('invalid_auth_response',503);
   if(saved&&(user as {id:string}).id!==saved.user)throw new StaffAuthError('session_rejected',401);
   return access;
  }catch(error){if(error instanceof StaffAuthError&&error.status===401)clear();throw error;}
 }
 async function logout(){try{const access=await token();await request('/auth/v1/logout?scope=local',access,{});}catch{/* Local sign-out must still work during an Auth outage. Never log tokens or responses. */}finally{clear();}}
 return {token,save,logout,clear};
}
