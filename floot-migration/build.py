import json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'floot-migration/app';out.mkdir(exist_ok=True)
assets=json.loads((root/'floot-migration/assets.json').read_text())
mapping={a['path']:a['url'] for a in assets}
data=json.loads((root/'recipes.json').read_text())
# Keep the imported records byte-equivalent as a separate reference; resolve only asset paths at runtime.
js=(root/'app.js').read_text()
js=js.replace("const rawRecipes = await loadCuratedPayload();",'const rawRecipes = '+json.dumps(data,ensure_ascii=False)+';')
js=js.replace("const rawArchive = await fetchJson('Archive/index.json', { optional: true });",'const rawArchive = null; // Verified source has no populated archive index.')
js=js.replace('state.recipes = [...state.baseRecipes, ...promoted];',"""state.recipes = [...state.baseRecipes, ...promoted];
  try { const response = await fetch('/_api/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({json:{action:'list'}})});if(response.ok){const payload=await response.json();const records=(payload.json||payload).records||[];for(const row of records.filter(x=>x.state==='saved')){const raw={...row.recipe,id:row.recipeId,method:row.recipe.method.map(x=>({heading:x.heading,text:x.directions})),favourite:false,card_pdf:''};if(raw.hero_image?.startsWith('private:')){const ar=await fetch('/_api/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({json:{action:'asset',id:row.id,revision:row.revision}})});if(ar.ok){const a=await ar.json();raw.hero_image=(a.json||a).imageUrl;}else raw.hero_image='';}state.recipes.push(normaliseRecipe(raw,0,false,false));}} }catch(error){console.warn('Private recipes unavailable',error);}
""")
js += "\nfor(const a of document.querySelectorAll('a[href=\"/studio\"]'))a.addEventListener('click',e=>{e.preventDefault();parent.postMessage({type:'bd-navigate',path:'/studio'},parent.location.origin)});\n"

js=js.replace("if ('serviceWorker' in navigator) {\n  window.addEventListener('load', () => navigator.serviceworker.register('sw.js').catch(console.error));\n}",'') if False else js
js=re.sub(r"if \('serviceWorker' in navigator\) \{.*?\n\}", '// Floot does not support a custom service worker. Offline cold-start parity is unresolved.',js,flags=re.S)
js='const assetMap = '+json.dumps(mapping)+';\n'+js
js=js.replace('    heroImage,','    heroImage: assetMap[heroImage] || heroImage,').replace('    cardPdf,','    cardPdf: assetMap[cardPdf] || cardPdf,')
js=js.replace('fetch(recipe.markdown)','fetch(assetMap[recipe.markdown] || recipe.markdown)')
js=js.replace('2-page A4 landscape card','Original 2-page A4 portrait card')
js+=(root/'floot-migration/backup.js').read_text()
js+='\nwindow.__recipeMigration = {makeBackup, validateBackup};\n'
html=(root/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet"[^>]+>', '<style>'+ (root/'styles.css').read_text()+'</style>',html)
html=html.replace('href="manifest.webmanifest"','href="/manifest.json"')
for path,url in mapping.items(): html=html.replace('"'+path+'"','"'+url+'"')
html=html.replace('<main>','<main><details class="panel" style="margin:12px"><summary>Backup and migration status</summary><p>Library beta. Original recipes and cards are preserved. Studio still opens the existing service. Offline launch and landscape card generation are not ready for cutover.</p><button id="exportAll" type="button">Export all device data</button> <label class="secondary">Restore backup <input id="importAll" type="file" accept="application/json,.json"></label><p id="backupStatus" role="status">Export on the original domain before moving between sites. Restore replaces matching settings and preserves recipe IDs.</p></details>')
html=re.sub(r'<script type="module" src="app.js[^>]+></script>',lambda m:'<script type="module">'+js.replace('</script','<\\/script')+'</script>',html)
html=html.replace('https://studio.recipes.bloodydaves.com','/studio')
html=html.replace('Studio still opens the existing service. Offline launch and landscape card generation are not ready for cutover.','Private Studio is available for approved accounts. Offline launch remains unresolved; production cutover has not occurred.')
html=html.replace('<head>','<head><base target="_blank">')
# srcDoc has this origin's storage. Keep its internal route separate from external links.
html=html.replace('href="#library"','href="#library" target="_self"')
(out/'library.html').write_text(html)
(out/'helpers').mkdir(exist_ok=True)
(out/'helpers/recipeDocument.tsx').write_text('export const recipeDocument = '+json.dumps(html,ensure_ascii=False)+';\n')
(out/'pages').mkdir(exist_ok=True)
(out/'pages/_index.tsx').write_text('''import React, {useEffect,useRef} from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { recipeDocument } from "../helpers/recipeDocument";
import styles from "./_index.module.css";
export default function Recipes() {
 const ref=useRef<HTMLIFrameElement>(null);const navigate=useNavigate();useEffect(()=>{const listener=(e:MessageEvent)=>{if(e.source===ref.current?.contentWindow&&e.data?.type==='bd-navigate'&&e.data.path==='/studio')navigate('/studio');};window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);},[navigate]);
 return <><Helmet><title>Bloody Dave's Recipes</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><link rel="manifest" href="/manifest.json"/></Helmet><iframe ref={ref} className={styles.app} title="Bloody Dave recipe library" srcDoc={recipeDocument} /></>;
}
''')
(out/'pages/_index.module.css').write_text('.app {width:100%;height:100dvh;border:0;display:block;background:#121714;}')
(out/'pages/_index.pageLayout.tsx').write_text('export default [];\n')
(out/'static').mkdir(exist_ok=True)
manifest=json.loads((root/'manifest.webmanifest').read_text());manifest['start_url']='/';manifest['scope']='/'
for icon in manifest.get('icons',[]):icon['src']=mapping.get(icon['src'],icon['src'])
(out/'static/manifest.json').write_text(json.dumps(manifest))
(out/'static/recipes.json').write_bytes((root/'recipes.json').read_bytes())
print('Built preserved application:',len(html),'characters; assets:',len(mapping))
