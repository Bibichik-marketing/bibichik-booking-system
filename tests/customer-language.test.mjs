import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const languageUrl=uri(compile('lib/customer-language.ts'));
const {customerLanguages,customerLanguageUrl,customerLocale}=await import(languageUrl);
const imports={react:import.meta.resolve('react'),'react/jsx-runtime':import.meta.resolve('react/jsx-runtime'),'lucide-react':import.meta.resolve('lucide-react'),'@/lib/customer-language':languageUrl};
const js=compile('components/reservation/CustomerLanguageSelector.tsx').replace(/from (['"])(.*?)\1/g,(_a,_q,name)=>'from '+JSON.stringify(imports[name]??name));
const {default:Selector}=await import(uri(js));
test('all five customer locales render native names and exactly one current checkmark with accessible disclosure',()=>{
 assert.deepEqual(customerLanguages.map(l=>l.name),['English','简体中文','Bahasa Melayu','한국어','日本語']);
 for(const current of customerLanguages){const html=renderToStaticMarkup(createElement(Selector,{locale:current.code,onSelect(){}}));assert.ok(html.includes('<summary'));assert.ok(html.includes('aria-label="'+current.label+': '+current.name+'"'));for(const language of customerLanguages)assert.ok(html.includes(language.name));assert.equal((html.match(/aria-current="true"/g)||[]).length,1);assert.ok(html.includes('lang="'+current.code+'" aria-current="true"'));assert.ok(html.includes(current.short));}
});
test('in-place language URLs preserve query flags and private status fragment without putting tokens into queries',()=>{
 for(const language of customerLanguages){assert.equal(customerLanguageUrl('https://example.invalid/en/reserve?demo=1',language.code),'/'+language.code+'/reserve?demo=1');assert.equal(customerLanguageUrl('https://example.invalid/zh/status#synthetic-private-fragment',language.code),'/'+language.code+'/status#synthetic-private-fragment');assert.equal(customerLocale('/'+language.code+'/reserve','en'),language.code);}
 assert.equal(customerLocale('/staff','ms'),'ms');assert.equal(customerLocale(null,'en'),'en');assert.throws(()=>customerLanguageUrl('https://example.invalid/en/reserve','xx'));assert.throws(()=>customerLanguageUrl('https://example.invalid/staff','en'));
});
test('customer hook switches through supported native history, preserves existing state and never writes customer data to storage',async()=>{
 const pathnameUrl=uri('export let pathname="/en/reserve";export const usePathname=()=>pathname;export function changePath(p){pathname=p}');
 const map={'react':uri('export const useEffect=()=>{}'),'next/navigation':pathnameUrl,'@/lib/customer-language':languageUrl,'@/lib/reservation-copy':uri(compile('lib/reservation-copy.ts')),'@/lib/status-copy':uri(compile('lib/status-copy.ts'))};
 const hook=await import(uri(compile('components/reservation/useCustomerLocale.ts').replace(/from (['"])(.*?)\1/g,(_a,_q,name)=>'from '+JSON.stringify(map[name]??name))));
 const {changePath}=await import(pathnameUrl);const previous=globalThis.window;const calls=[];globalThis.window={location:{href:'https://example.invalid/en/reserve?demo=1'},history:{replaceState(...args){calls.push(args)}}};
 try{const current=hook.useCustomerLocale('en');current.switchLocale('zh');assert.deepEqual(calls,[[null,'','/zh/reserve?demo=1']]);changePath('/zh/reserve');assert.equal(hook.useCustomerLocale('en').locale,'zh');assert.equal(hook.useCustomerLocale('ms',true).locale,'ms');hook.useCustomerLocale('ms',true).switchLocale('ja');assert.equal(calls.length,1);}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
 const source=readFileSync('components/reservation/useCustomerLocale.ts','utf8');assert.ok(!source.includes('localStorage'));assert.ok(!source.includes('sessionStorage'));
});
