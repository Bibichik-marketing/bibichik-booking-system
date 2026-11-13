import {cookies} from 'next/headers';
import {staffRequest,StaffAuthError} from './staff-auth';
export {StaffAuthError,staffFailure,validStaffSession} from './staff-auth';
export async function supabaseRequest(path:string,token:string,body?:unknown){return staffRequest(path,token,body,process.env)}
export async function staffToken(){const token=(await cookies()).get('bbc_staff')?.value;if(!token)throw new StaffAuthError('missing_session',401);return token}
