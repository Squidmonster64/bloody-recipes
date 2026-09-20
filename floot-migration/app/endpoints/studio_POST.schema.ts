import { z } from 'zod';
import superjson from 'superjson';
import { recipeSchema } from '../helpers/recipeSchema';
export const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('list')}),
 z.object({action:z.literal('generate'),url:z.string().min(8).max(2000),instructions:z.string().max(4000).default(''),pasted:z.string().max(100000).default('')}),
 z.object({action:z.literal('save'),id:z.string().uuid(),revision:z.number().int(),recipe:recipeSchema}),
 z.object({action:z.literal('image'),id:z.string().uuid(),revision:z.number().int()}),
 z.object({action:z.literal('export')}),
 z.object({action:z.literal('asset'),id:z.string().uuid(),revision:z.number().int()}),
 z.object({action:z.literal('restore'),records:z.array(z.object({id:z.string().uuid(),recipe:recipeSchema,sourceFacts:z.record(z.string(),z.any()),state:z.enum(['draft','saved']),revision:z.number().int().positive(),createdAt:z.coerce.date(),updatedAt:z.coerce.date(),recipeId:z.string().nullable(),fingerprint:z.string().nullable()})).max(1000)})
]);
export type InputType=z.infer<typeof schema>;
export type OutputType={records?:any[];record?:any;error?:string;restored?:number;skipped?:number;imageUrl?:string};
export async function postStudio(body:InputType):Promise<OutputType>{const r=await fetch('/_api/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:superjson.stringify(schema.parse(body))});const result=superjson.parse<OutputType>(await r.text());if(!r.ok)throw Error(result.error||'Studio request failed');return result;}
