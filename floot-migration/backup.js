const backupKeys = Object.values(STORAGE);
function makeBackup() {
  return { format: 'bloody-daves-browser-backup', version: 1, exportedAt: new Date().toISOString(), origin: location.origin, values: Object.fromEntries(backupKeys.map(k => [k, localStorage.getItem(k)])) };
}
function validateBackup(data) {
  if (data?.format !== 'bloody-daves-browser-backup' || data.version !== 1 || !data.values || typeof data.values !== 'object') throw Error('This is not a Bloody Dave browser backup.');
  const arrays = [STORAGE.selected, STORAGE.legacyHave, STORAGE.promoted, STORAGE.savedRecipes];
  for (const [k,v] of Object.entries(data.values)) {
    if (!backupKeys.includes(k) || (v !== null && typeof v !== 'string')) throw Error('Unknown or invalid backup field: '+k);
    if (v === null) continue;
    const parsed = JSON.parse(v);
    if (arrays.includes(k) ? !Array.isArray(parsed) : (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) throw Error('Invalid data: '+k);
    if ([STORAGE.selected, STORAGE.legacyHave].includes(k) && parsed.some(x => typeof x !== 'string')) throw Error('Invalid selected IDs');
    if ([STORAGE.savedRecipes, STORAGE.promoted].includes(k)) {
      const ids = new Set();
      for (const r of parsed) { if (!r || typeof r.id !== 'string' || !r.id || typeof r.title !== 'string' || ids.has(r.id)) throw Error('Missing or duplicate recipe identity'); ids.add(r.id); }
    }
    if (k===STORAGE.favouriteOverrides && Object.values(parsed).some(v=>typeof v!=='boolean')) throw Error('Invalid favourites');
    if (k===STORAGE.itemStatuses && Object.values(parsed).some(v=>!['have','need'].includes(v))) throw Error('Invalid shopping status');
  }
  return data;
}
document.getElementById('exportAll').onclick = () => downloadText('bloody-daves-browser-backup.json', JSON.stringify(makeBackup(), null, 2), 'application/json');
document.getElementById('importAll').onchange = async e => {
 const status = document.getElementById('backupStatus');
 try {
   const file=e.target.files?.[0]; if(!file)return;
   if(file.size>10000000)throw Error('Backup exceeds 10 MB.');
   const incoming=validateBackup(JSON.parse(await file.text()));
   if(!confirm('Restore this backup on this device? Current settings will be downloaded as a safety backup first.'))return;
   const before=makeBackup(); downloadText('bloody-daves-before-restore.json',JSON.stringify(before,null,2),'application/json');
   try { for(const k of backupKeys){const v=incoming.values[k];if(v===null)localStorage.removeItem(k);else if(v!==undefined)localStorage.setItem(k,v);} }
   catch(error){for(const [k,v] of Object.entries(before.values)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}throw error;}
   location.reload();
 } catch(error){status.textContent='Restore failed: '+error.message;} finally {e.target.value='';}
};
