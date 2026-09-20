import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { recipeSchema } from './recipeSchema';

export async function renderRecipeCard(input:{recipe:unknown;id:string;regular:Uint8Array;bold:Uint8Array;logo:Uint8Array;hero:Uint8Array}){
 const r=recipeSchema.parse(input.recipe);const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(input.regular,{subset:true}),bold=await doc.embedFont(input.bold,{subset:true});
 const image=async(b:Uint8Array)=>b[0]===137?doc.embedPng(b):doc.embedJpg(b);
 const logo=await image(input.logo),hero=await image(input.hero);const qr=await doc.embedPng(await QRCode.toDataURL('https://recipes.bloodydaves.com',{errorCorrectionLevel:'M',margin:1,width:240}));
 const W=841.89,H=595.28;const cream=rgb(.969,.957,.929),ink=rgb(.173,.153,.137),orange=rgb(.894,.278,.075),green=rgb(.306,.478,.169),white=rgb(1,.992,.988);
 let p=doc.addPage([W,H]);
 const rect=(x:number,y:number,w:number,h:number,color:any)=>p.drawRectangle({x,y:H-y-h,width:w,height:h,color});
 const lines=(s:string,font:any,size:number,width:number)=>{const out:string[]=[];for(const line of s.split('\n')){let run='';for(const word of line.split(/\s+/)){if(font.widthOfTextAtSize(word,size)>width)throw Error('Card text contains an overlong word or URL. Shorten the display text.');const test=run?run+' '+word:word;if(font.widthOfTextAtSize(test,size)>width){out.push(run);run=word;}else run=test;}out.push(run);}return out;};
 const text=(s:string,x:number,y:number,width:number,height:number,size=10,font=regular,color=ink)=>{const ls=lines(s,font,size,width);const leading=size*1.25;if(ls.length*leading>height+.01)throw Error('Card text does not fit: '+s.slice(0,70)+'. Shorten this field; no text was clipped.');ls.forEach((line,i)=>p.drawText(line,{x,y:H-y-size-i*leading,size,font,color}));return ls.length*leading;};
 const contain=(im:any,x:number,y:number,w:number,h:number)=>{const sc=Math.min(w/im.width,h/im.height);p.drawImage(im,{x:x+(w-im.width*sc)/2,y:H-y-h+(h-im.height*sc)/2,width:im.width*sc,height:im.height*sc});};
 const footer=()=>{rect(0,542,W,53,ink);contain(logo,20,546,42,42);text('BIG FLAVOUR. NO WORRIES.',74,548,345,16,12,bold,white);text(r.bloody_dave_quote||r.title,74,565,345,22,7,regular,white);text('info@bloodydaves.com\nhttps://recipes.bloodydaves.com',443,549,210,26,7,regular,white);text(r.source_credit&&r.source_credit!=='Adapted from publisher'?r.source_credit:'Adapted from '+r.source,443,577,300,10,6.5,regular,white);contain(qr,774,546,42,42);text(input.id.replaceAll('-','- '),675,548,90,38,6.5,regular,white);};
 // Landscape adaptation of the preserved Bloody Dave front: left brand/time rail, dominant hero, ingredient strip.
 rect(0,0,W,H,cream);contain(logo,20,18,155,115);text(r.title,205,24,610,80,28,bold,orange);text(r.subtitle||r.cuisine,205,104,610,28,11,bold,green);
 rect(205,139,611,2,orange);contain(hero,205,153,610,337);
 text(['PREP '+(r.prep_time||'Not supplied'),'COOK '+(r.cook_time||'Not supplied'),'READY '+(r.total_time||'Not supplied'),'SERVES '+(r.serves||'Not supplied')].join('\n\n'),24,155,165,170,11,bold,green);
 text(r.hook,24,340,165,139,10,regular);text('BUY: '+r.buy.slice(0,3).join(' · '),24,495,790,31,9,bold);text('PANTRY: '+r.pantry.join(' · '),24,528,790,14,8);footer();
 // Back: ingredient and nutrition panels, six sequential method panels, locked footer.
 p=doc.addPage([W,H]);rect(0,0,W,H,cream);rect(24,16,492,21,green);text('INGREDIENTS',31,19,470,17,13,bold,white);rect(531,16,285,21,orange);text('NUTRITION & ALLERGENS',539,19,270,17,13,bold,white);
 const clean=(i:string)=>i.replace(/\(Note \d+\)/g,'').replace(/\([0-9.]+\s*oz\)/g,'').replace(/[()*]/g,'').replace(/\s+,/g,',').replace(/\s+/g,' ').trim();const ingredients=[...r.buy.map(i=>'• '+clean(i)),...r.pantry.map(i=>'Pantry: '+clean(i))];const split=Math.ceil(ingredients.length/2);text(ingredients.slice(0,split).join('\n'),28,43,232,153,9);text(ingredients.slice(split).join('\n'),278,43,232,153,9);
 let nutrition=r.nutrition;try{const n=JSON.parse(nutrition);nutrition=Object.entries(n).filter(([k])=>!k.startsWith('@')).map(([k,v])=>k.replace(/Content$/,'')+': '+String(v)).join(' · ');}catch{}
 text(nutrition,539,44,270,72,9);text(r.allergens,539,120,270,45,9);text('METHOD',24,202,750,19,13,bold);
 r.method.forEach((s,i)=>{const x=24+(i%3)*269,y=227+Math.floor(i/3)*149;rect(x,y,254,139,white);rect(x,y,254,24,green);text((i+1)+'. '+s.heading,x+8,y+4,238,17,11,bold,white);text(s.directions,x+8,y+32,238,100,10);});
 footer();doc.setTitle(r.title+' — Bloody Dave');doc.setSubject('A4 landscape duplex; print at 100%, flip on short edge.');doc.setCreator('Bloody Dave Recipe Studio — Floot beta');
 return doc.save();
}
