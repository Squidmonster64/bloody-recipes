import superjson from 'superjson';
import { isDeepStrictEqual } from 'node:util';
import { createHash,randomUUID } from 'node:crypto';
import { schema } from './studio_POST.schema';
import { getServerUserSession } from '../helpers/getServerUserSession';
import { db } from '../helpers/db';
import { fetchRecipeSource } from '../helpers/fetchRecipeSource';
import { normaliseRecipeDraft } from '../helpers/normaliseRecipeDraft';
import { recipeSchema } from '../helpers/recipeSchema';
import { upload, getUrl } from '@floot/storage';
const reply=(data:any,status=200)=>new Response(superjson.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function handle(request:Request){
 let user:any;
 try{({user}=await getServerUserSession(request));}catch{return reply({error:'Sign in to Recipe Studio.'},401);}
 if(user.role!=='admin')return reply({error:'Studio access has not been enabled for this account.'},403);
 try{
  const input=schema.parse(superjson.parse(await request.text()));
  if(input.action==='list'||input.action==='export')return reply({records:await db.selectFrom('recipeDrafts').selectAll().where('userId','=',user.id).orderBy('updatedAt','desc').execute()});
  if(input.action==='restore'){
   const restored=await db.transaction().execute(async trx=>{let n=0;for(const r of input.records){const existing=await trx.selectFrom('recipeDrafts').selectAll().where('id','=',r.id).executeTakeFirst();if(existing){if(existing.userId!==user.id||!isDeepStrictEqual(recipeSchema.parse(existing.recipe),r.recipe))throw Error('Restore conflict for '+r.id+'. Nothing was restored.');continue;}const v=await trx.insertInto('recipeDrafts').values({...r,recipe:r.recipe,sourceFacts:r.sourceFacts,userId:user.id}).onConflict(o=>o.columns(['userId','fingerprint']).doNothing()).returning('id').executeTakeFirst();if(v)n++;}return n;});return reply({restored,skipped:input.records.length-restored});
  }
  if(input.action==='generate'){
   const recent=await db.selectFrom('recipeDrafts').select('id').where('userId','=',user.id).where('createdAt','>',new Date(Date.now()-3600000)).execute();if(recent.length>=20)return reply({error:'Generation limit reached. Try again in an hour.'},429);
   const source=await fetchRecipeSource(input.url,input.pasted);
   const fingerprint=createHash('sha256').update(source.source_hash+'\n'+input.instructions.trim()).digest('hex');
   const old=await db.selectFrom('recipeDrafts').selectAll().where('userId','=',user.id).where('fingerprint','=',fingerprint).executeTakeFirst();if(old)return reply({record:old});
   const recipe=await normaliseRecipeDraft(source,input.instructions);
   const inserted=await db.insertInto('recipeDrafts').values({id:randomUUID(),userId:user.id,recipe,sourceFacts:source,fingerprint}).onConflict(o=>o.columns(['userId','fingerprint']).doNothing()).returningAll().executeTakeFirst();
   return reply({record:inserted||await db.selectFrom('recipeDrafts').selectAll().where('userId','=',user.id).where('fingerprint','=',fingerprint).executeTakeFirst()});
  }
  const row=await db.selectFrom('recipeDrafts').selectAll().where('id','=',input.id).where('userId','=',user.id).executeTakeFirst();if(!row)return reply({error:'Recipe not found.'},404);if(row.revision!==input.revision)return reply({error:'Recipe changed in another window. Reload before saving.'},409);
  if(input.action==='asset'){const recipe=recipeSchema.parse(row.recipe);if(recipe.hero_image!=='private:recipes/'+user.id+'/'+row.id+'-hero.png')return reply({error:'Generate an image first.'},404);const u=await getUrl({visibility:'private',filename:recipe.hero_image.slice(8)});if(!u.ok)throw Error('Image unavailable');return reply({imageUrl:u.url});}
  if(input.action==='save'){
   const recipe=recipeSchema.parse(input.recipe);const original=recipeSchema.parse(row.recipe);
   // Editing ingredients, yield or method invalidates source nutrition; source provenance cannot be edited away.
   recipe.source_url=original.source_url;recipe.source=original.source;
   if(JSON.stringify([recipe.buy,recipe.pantry,recipe.method,recipe.serves])!==JSON.stringify([original.buy,original.pantry,original.method,original.serves])){recipe.nutrition='Nutrition not supplied for this adapted version';recipe.nutrition_basis='not_supplied_after_adaptation';}
   else {recipe.nutrition=original.nutrition;recipe.nutrition_basis=original.nutrition_basis;}
   recipe.hero_image=original.hero_image;recipe.card_pdf=undefined;
   // Permanent BD numbering remains with the live publisher until cutover. Private beta identities are stable UUIDs.
   recipe.id=row.recipeId||'BD-BETA-'+row.id;
   const updated=await db.updateTable('recipeDrafts').set({recipe,recipeId:recipe.id,state:'saved',revision:row.revision+1,updatedAt:new Date()}).where('id','=',row.id).where('userId','=',user.id).where('revision','=',input.revision).returningAll().executeTakeFirst();if(!updated)return reply({error:'Recipe changed while saving. Reload.'},409);return reply({record:updated});
  }
  const recipe=recipeSchema.parse(row.recipe);
  if(recipe.hero_image)return reply({record:row});
  if(!process.env.RECIPES_API_KEY)return reply({error:'Image generation is blocked: OpenAI key is not configured.'},503);
  const r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:'Bearer '+process.env.RECIPES_API_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(110000),body:JSON.stringify({model:'gpt-image-1',size:'1536x1024',n:1,prompt:'Natural food photography of '+(recipe.hero_image_subject||recipe.title)+'. Finished adapted dish using '+recipe.buy.join(', ')+'. Australian home kitchen lighting. No text, logo, watermark, border or QR. Realistic proportions.'})});
  if(!r.ok)return reply({error:'Image provider failed (HTTP '+r.status+'). No placeholder was created.'},502);
  const image=await r.json();const encoded=image.data?.[0]?.b64_json;if(!encoded)return reply({error:'Image provider returned no image. No placeholder was created.'},502);
  const bytes=Buffer.from(encoded,'base64');const u=await upload({visibility:'private',filename:'recipes/'+user.id+'/'+row.id+'-hero.png',contentType:'image/png',sizeBytes:bytes.length});if(!u.ok)throw Error('Image storage unavailable.');
  const put=await fetch(u.presignedUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes});if(!put.ok)throw Error('Image upload failed.');
  // Persist a storage identity, never an expiring signed URL.
  recipe.hero_image='private:recipes/'+user.id+'/'+row.id+'-hero.png';
  const updated=await db.updateTable('recipeDrafts').set({recipe,revision:row.revision+1,updatedAt:new Date()}).where('id','=',row.id).where('revision','=',row.revision).returningAll().executeTakeFirst();if(!updated)return reply({error:'Recipe changed during image generation. Reload.'},409);return reply({record:updated});
 }catch(error){return reply({error:error instanceof Error?error.message:'Studio failed.'},400);}
}
