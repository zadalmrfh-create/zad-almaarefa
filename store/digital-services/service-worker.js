const CACHE='malek-static-v6-sprix-100';
const ASSETS=['./','./index.html','./checkout.html','./track.html','./account.html','./admin.html','./terms.html','./privacy.html','./css/styles.css','./js/shared.js','./js/admin-access.js','./js/firebase-config.js','./js/site.js','./js/checkout.js','./js/track.js','./js/account.js','./js/admin.js','./favicon.svg','./assets/malek.webp','./assets/og-cover.webp'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 if(req.mode==='navigate'){e.respondWith(fetch(req).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));return;}
 e.respondWith(caches.match(req).then(r=>r||fetch(req).then(resp=>{if(resp.ok&&ASSETS.some(a=>new URL(a,self.registration.scope).pathname===new URL(req.url).pathname)){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return resp;})));
});
