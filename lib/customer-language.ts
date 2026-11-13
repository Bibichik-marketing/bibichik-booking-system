export const customerLanguages=[
 {code:'en',name:'English',short:'EN',label:'Language'},
 {code:'zh',name:'简体中文',short:'ZH',label:'语言'},
 {code:'ms',name:'Bahasa Melayu',short:'MS',label:'Bahasa'},
 {code:'ko',name:'한국어',short:'KO',label:'언어'},
 {code:'ja',name:'日本語',short:'JA',label:'言語'},
] as const;
export function customerLocale(pathname:string|null,fallback:string){const match=pathname?.match(/^\/(en|zh|ms|ko|ja)\/(reserve|status)\/?$/);return match?.[1]??fallback;}
// Change only the locale segment. Keep query flags and private status fragments in memory/URL, never storage.
export function customerLanguageUrl(href:string,locale:string){
 if(!customerLanguages.some(l=>l.code===locale))throw Error('Unsupported language');
 const url=new URL(href);if(!/^\/(en|zh|ms|ko|ja)\/(reserve|status)\/?$/.test(url.pathname))throw Error('Unsupported customer page');
 url.pathname=url.pathname.replace(/^\/[^/]+/,`/${locale}`);return url.pathname+url.search+url.hash;
}
