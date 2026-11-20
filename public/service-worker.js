const CACHE_NAME='cpool-public-app-v85-results-connection';
const PAGES=new Set(['/resultats','/resultats.html','/quadrant','/quadrant.html','/estadistiques','/estadistiques.html','/historial.html','/enfrontaments.html','/pantalla.html','/tv-directe.html','/tv-table','/tv-table.html','/instal-lar.html','/offline.html']);
const CORE=['/app-polish.css?v=20261109-1','/mobile.css?v=20261106-1','/offline.html','/resultats','/styles.css','/resultats-theme.css','/resultats-layout.css?v=8','/resultats.js?v=2','/results-motion.css?v=20261103-1','/results-motion.js?v=20261103-1','/results-large.css?v=20261101-1','/results-large.js?v=20261101-1','/connection.js?v=20261106-1','/connection.css?v=20261106-1','/logo.js','/pwa.js','/cpool-logo.png','/tv-table-1-poster.webp','/tv-table-2-poster.webp','/manifest.webmanifest'];
const PRIVATE=new Set(['/admin-workspace.js','/sponsor-screen-admin.js','/broadcast-admin.js','/admin.js','/app.js','/server-guard.js','/live-relay-server.js','/championship-backup.js','/production-admin.js','/operations-admin.js','/quadrant-control.js','/jugadors.js']);
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await Promise.allSettled(CORE.map(async url=>{const r=await fetch(url,{cache:'reload'});if(r.ok&&r.headers.get('X-CPool-App')==='1')await cache.put(url,r)}));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('cpool-public-app-')&&key!==CACHE_NAME)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url);if(req.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')||PRIVATE.has(u.pathname)||u.pathname==='/service-worker.js')return;
 const navigation=req.mode==='navigate';if(navigation&&!PAGES.has(u.pathname))return;
 if(!navigation&&!/\.(?:js|css|png|jpe?g|webp|svg|webmanifest)$/.test(u.pathname))return;
 const fastLaunch=navigation
  ? u.pathname==='/resultats'||u.pathname==='/resultats.html'
  : CORE.includes(u.pathname+u.search);
 const cacheReady=caches.open(CACHE_NAME);
 const cached=cacheReady.then(cache=>cache.match(req,{ignoreSearch:navigation&&!u.pathname.startsWith("/tv-")}));
 const fresh=(async()=>{
  const cache=await cacheReady;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6000);
  try{
   const response=await fetch(req,{signal:controller.signal,cache:'no-cache'});
   if(response.ok&&response.headers.get('X-CPool-App')==='1'){
    await cache.put(req,response.clone());
   }
   if(response.status<500)return response;
  }catch{}finally{clearTimeout(timer)}
  return undefined;
 })();
 if(fastLaunch)event.waitUntil(fresh);
 event.respondWith((async()=>{
  const response=fastLaunch?(await cached||await fresh):(await fresh||await cached);
  if(response)return response;
  if(navigation){
   const cache=await cacheReady;
   return await cache.match('/offline.html')||new Response('Sense connexió. Torna-ho a provar.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
  return new Response('',{status:503});
 })());
});
