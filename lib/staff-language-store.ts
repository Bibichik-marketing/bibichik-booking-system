import {staffLanguage,type StaffLanguage} from './staff-copy';
export const staffLanguageKey='bibichik.staff.language';
type PreferenceStorage=Pick<Storage,'getItem'|'setItem'>;
export function createStaffLanguageStore(storage:()=>PreferenceStorage|null,notify:()=>void){
 let memory:StaffLanguage='en';
 return {get(){try{return staffLanguage(storage()?.getItem(staffLanguageKey)??memory)}catch{return memory}},set(value:string){memory=staffLanguage(value);try{storage()?.setItem(staffLanguageKey,memory)}catch{}notify()}};
}
