// Coalesce identical admin collection reads; short TTL avoids repeated downloads.
const pending=new Map(),recent=new Map();
const TTL=8000;
let lastUid='';
export function clearAdminReadCache(){recent.clear();pending.clear();}
for(const ev of ['zad:attendance-changed','zad:attendance-archived','zad:payment-approved','zad:users-changed','zad:payroll-changed'])window.addEventListener(ev,clearAdminReadCache);
export function sharedAdminGetDocs(ref,raw,auth){
 if(ref?.type!=='collection'||!ref?.path)return raw(ref);
 const uid=auth.currentUser?.uid||'';
 if(uid!==lastUid){clearAdminReadCache();lastUid=uid;}
 const key=uid+'|'+ref.firestore.app.name+'|'+ref.path;
 const old=recent.get(key);
 if(old&&Date.now()-old.at<TTL)return Promise.resolve(old.snapshot);
 if(pending.has(key))return pending.get(key);
 const promise=raw(ref).then(snapshot=>{recent.set(key,{at:Date.now(),snapshot});return snapshot;}).finally(()=>pending.delete(key));
 pending.set(key,promise);return promise;
}
