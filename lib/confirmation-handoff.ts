type Popup={closed:boolean;close:()=>void;location:{replace:(url:string)=>void}};
/** Called only after the authenticated confirmation response succeeds. Never changes status. */
export function finishConfirmationHandoff(popup:Popup|null,url:unknown):string|null{
 if(typeof url!=='string'||!url.startsWith('https://wa.me/')){popup?.close();return null}
 // Always retain a manual fallback, including blocked or manually closed windows.
 try{if(popup&&!popup.closed)popup.location.replace(url)}catch{popup?.close()}
 return url;
}
