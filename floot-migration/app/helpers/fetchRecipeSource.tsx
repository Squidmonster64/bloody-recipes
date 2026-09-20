import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';

export async function fetchRecipeSource(input:string,pasted='') {
 let url:URL;try{url=new URL(input);}catch{throw Error('Enter a valid recipe URL.');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname)throw Error('Only public HTTP or HTTPS recipe URLs are accepted.');
 const submitted=url.href;let html=pasted,method='pasted';
 if(!pasted){
  for(let hop=0;hop<=5;hop++){
   if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!['','80','443'].includes(url.port))throw Error('Unsupported redirect or port.');
   const host=url.hostname.replace(/^\[|\]$/g,'');
   if(/(^|\.)(localhost|local|internal)$/.test(host))throw Error('Private source hosts are blocked.');
   const addresses=await lookup(host,{all:true});
   if(!addresses.length||addresses.some(x=>ipaddr.process(x.address).range()!=='unicast'))throw Error('Private or reserved source addresses are blocked.');
   const target=addresses[0];
   const response=await new Promise<{status:number;location?:string;body:string;type:string}>((resolve,reject)=>{
    const req=(url.protocol==='https:'?https:http).get(url,{headers:{'User-Agent':'BloodyDaveRecipeStudio/2.0','Accept':'text/html','Accept-Encoding':'identity'},lookup:((_host:any,options:any,cb:any)=>options?.all?cb(null,[target]):cb(null,target.address,target.family)) as any},res=>{
     let count=0;const chunks:Buffer[]=[];res.on('data',c=>{count+=c.length;if(count>3000000){req.destroy(Error('Source exceeds 3 MB.'));return;}chunks.push(c);});res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode||500,location:res.headers.location,body:Buffer.concat(chunks).toString('utf8'),type:String(res.headers['content-type']||'')}));
    });req.setTimeout(20000,()=>req.destroy(Error('Source timed out. Paste the recipe text instead.')));req.on('error',reject);
   });
   if([301,302,303,307,308].includes(response.status)){if(!response.location||hop===5)throw Error('Too many redirects or missing redirect target.');url=new URL(response.location,url);continue;}
   if(response.status>=400)throw Error('Source returned HTTP '+response.status+'. Paste the recipe text instead.');
   if(!/html|text\//i.test(response.type))throw Error('Source is not an HTML recipe page.');
   html=response.body;method='jsonld';break;
  }
 }
 const $=load(html);let recipe:any=null;
 const visit=(x:any):void=>{if(recipe||!x||typeof x!=='object')return;if([x['@type']].flat().includes('Recipe')){recipe=x;return;}for(const v of Object.values(x))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);};
 if(!pasted)$('script[type="application/ld+json"]').each((_,e)=>{try{visit(JSON.parse($(e).text()));}catch{}});
 const flatten=(v:any):string[]=>Array.isArray(v)?v.flatMap(flatten):typeof v==='string'?[load(v).text()]:v?.itemListElement?flatten(v.itemListElement):v?.text?[load(v.text).text()]:[];
 let facts:any;
 if(recipe){facts={title:load(recipe.name||'').text(),publisher:typeof recipe.author==='object'?[recipe.author].flat().map((a:any)=>a.name).join(', '):url.hostname,ingredients:flatten(recipe.recipeIngredient),instructions:flatten(recipe.recipeInstructions),serves:String(recipe.recipeYield||''),prep_time:String(recipe.prepTime||''),cook_time:String(recipe.cookTime||''),total_time:String(recipe.totalTime||''),cuisine:String(recipe.recipeCuisine||''),category:String(recipe.recipeCategory||''),nutrition_text:recipe.nutrition?JSON.stringify(recipe.nutrition):''};}
 else { $('script,style,nav,footer,header').remove();const excerpt=pasted||$.text().replace(/\s+/g,' ').trim();if(excerpt.length<80)throw Error('No usable recipe found. Paste the ingredient list and method.');facts={raw_excerpt:excerpt.slice(0,80000),nutrition_text:'',publisher:url.hostname};method=pasted?'pasted':'visible_text'; }
 facts.publisher=facts.publisher||({ 'www.recipetineats.com':'RecipeTin Eats','www.hellofresh.com.au':'HelloFresh Australia' } as Record<string,string>)[url.hostname]||url.hostname;facts.source_notes=$('.wprm-recipe-notes, .recipe-notes').text().trim().slice(0,20000);
 return {...facts,submitted_url:submitted,resolved_url:url.href,extraction_method:method,source_hash:createHash('sha256').update(html).digest('hex'),fetched_at:new Date().toISOString()};
}
