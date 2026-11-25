import {cookies} from 'next/headers';
import {staffRequest} from './staff-auth';
import {createStaffSession} from './staff-session';
export {StaffAuthError,staffFailure,validStaffSession} from './staff-auth';
export async function supabaseRequest(path:string,token:string,body?:unknown){return staffRequest(path,token,body,process.env)}
async function session(){return createStaffSession({jar:await cookies(),request:supabaseRequest,secret:process.env.SUPABASE_SERVICE_ROLE_KEY,production:process.env.NODE_ENV==='production'});}
export async function staffToken(){return (await session()).token();}
export async function saveStaffSession(data:unknown,remember:boolean){(await session()).save(data,remember);}
export async function clearStaffSession(){(await session()).clear();}
export async function logoutStaffSession(){await (await session()).logout();}
