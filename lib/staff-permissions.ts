import {StaffAuthError} from './staff-auth';
export const bookingOutlets=['bibichik-ss2','bibichik-sunway-163'] as const;
export type StaffProfile={isAdmin:boolean;canArchive:boolean;outlets:string[]};

export async function staffProfile(token:string,request:(path:string,token:string,body?:unknown)=>Promise<unknown>):Promise<StaffProfile>{
 const isAdmin=await request('/rest/v1/rpc/staff_archive_capability_v2',token,{})===true;
 if(isAdmin)return {isAdmin:true,canArchive:true,outlets:[...bookingOutlets]};
 const outlets:string[]=[];const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 for(const outlet of bookingOutlets){try{await request('/rest/v1/rpc/staff_timeline_v2',token,{outlet,day});outlets.push(outlet);}catch(error){if(!(error instanceof StaffAuthError&&error.category==='membership_denied'&&error.status===403))throw error;}}
 if(!outlets.length)throw new StaffAuthError('membership_denied',403);
 return {isAdmin:false,canArchive:false,outlets};
}
