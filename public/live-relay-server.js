// Short-lived signaling only. Video travels directly between browsers.
module.exports=function createLiveRelay({isAdmin,readBody,sendJson,production=()=>({})}){
 const sessions=new Map(),limit=6;let lastSweep=0;
 const crypto=require('crypto');
 function send(session,message){if(session.wait){const reply=session.wait;session.wait=null;reply([message]);}else{session.queue.push(message);if(session.queue.length>80)close(session)}}
 function publisher(table){return [...sessions.values()].find(s=>s.role==='publisher'&&s.table===table)}
 function close(session){if(!sessions.delete(session.id))return;session.wait?.([]);session.wait=null;if(session.role==='publisher'){for(const viewer of [...sessions.values()].filter(s=>s.table===session.table)){send(viewer,{type:'offline'});close(viewer)}}else{const pub=publisher(session.table);if(pub)send(pub,{type:'leave',from:session.id})}}
 function sweep(){const now=Date.now();if(now-lastSweep<5000)return;lastSweep=now;for(const s of [...sessions.values()])if(now-s.at>45000)close(s)}
 function cloudConfig(table){const publishUrl=String(process.env['CLOUDFLARE_WHIP_'+table]||'').trim(),playbackUrl=String(process.env['CLOUDFLARE_WHEP_'+table]||'').trim();const publish=/^https:\/\/customer-[a-zA-Z0-9-]+\.cloudflarestream\.com\/[a-zA-Z0-9_-]+\/webRTC\/publish$/.test(publishUrl),play=/^https:\/\/customer-[a-zA-Z0-9-]+\.cloudflarestream\.com\/[a-zA-Z0-9_-]+\/webRTC\/play$/.test(playbackUrl);const configured=publish&&play&&new URL(publishUrl).origin===new URL(playbackUrl).origin;return{table,dvr:production()?.[table]?.dvr===true,configured,playbackUrl:configured?playbackUrl:'',publishUrl:configured?publishUrl:''}}
 function config(){const iceServers=[{urls:'stun:stun.l.google.com:19302'}];try{const extra=JSON.parse(process.env.LIVE_ICE_SERVERS||'[]');if(Array.isArray(extra))iceServers.push(...extra.filter(x=>x&&x.urls).slice(0,4))}catch{}return{iceServers}}
 const route=async function liveRoute(req,res,url){if(!url.pathname.startsWith('/api/live/'))return false;sweep();res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'&&url.pathname==='/api/live/cloud-config'){sendJson(res,200,{tables:[1,2].map(table=>{const c=cloudConfig(table);return{table,configured:c.configured,playbackUrl:c.playbackUrl,dvr:c.dvr}})});return true}
  if(req.method==='GET'&&url.pathname==='/api/live/cloud-publish'){if(!isAdmin(req)){sendJson(res,401,{error:'Cal iniciar sessió com a administrador'});return true}const c=cloudConfig(Number(url.searchParams.get('table')));if(![1,2].includes(c.table)||!c.configured){sendJson(res,400,{error:'Cloudflare Stream encara no està configurat per a aquesta taula'});return true}sendJson(res,200,{publishUrl:c.publishUrl});return true}
  if(req.method==='GET'&&url.pathname==='/api/live/status'){sendJson(res,200,{limit,relayConfigured:config().iceServers.some(s=>JSON.stringify(s.urls).includes('turn:')||JSON.stringify(s.urls).includes('turns:')),tables:[1,2].map(table=>({table,provider:cloudConfig(table).configured?'cloudflare':'direct',online:!!publisher(table),viewers:[...sessions.values()].filter(s=>s.table===table&&s.role==='viewer').length}))});return true}
  if(req.method!=='POST'){sendJson(res,405,{error:'Mètode no permès'});return true}
  try{const body=JSON.parse(await readBody(req)||'{}');
   if(url.pathname==='/api/live/session'){
    const table=Number(body.table),role=body.role;if(![1,2].includes(table)||!['publisher','viewer'].includes(role))throw Error('Taula o connexió no vàlida');
    if(role==='publisher'&&!isAdmin(req)){sendJson(res,401,{error:'Cal iniciar sessió com a administrador'});return true}
    const pub=publisher(table);if(role==='publisher'&&pub){sendJson(res,409,{error:'Aquesta taula ja s’emet des d’un altre panell. Atura l’emissió abans de canviar-la.'});return true}
    if(role==='viewer'&&!pub){sendJson(res,404,{error:'En espera de l’emissió'});return true}
    if(role==='viewer'&&[...sessions.values()].filter(s=>s.table===table&&s.role==='viewer').length>=limit){sendJson(res,429,{error:'Emissió directa completa. Torna-ho a provar més tard.'});return true}
    const s={id:crypto.randomBytes(16).toString('hex'),token:crypto.randomBytes(32).toString('hex'),table,role,admin:isAdmin(req),at:Date.now(),queue:[]};sessions.set(s.id,s);if(pub)send(pub,{type:'join',from:s.id});sendJson(res,200,{id:s.id,token:s.token,configuration:config(),limit});return true;
   }
   const s=sessions.get(body.id);if(!s||body.token!==s.token){sendJson(res,401,{error:'Connexió caducada'});return true}s.at=Date.now();
   if(s.role==='publisher'&&!isAdmin(req)){close(s);sendJson(res,401,{error:'Sessió d’administració caducada'});return true}
   if(url.pathname==='/api/live/leave'){close(s);sendJson(res,200,{ok:true});return true}
   if(url.pathname==='/api/live/poll'){sendJson(res,200,{messages:s.queue.splice(0)});return true}
   if(url.pathname==='/api/live/signal'){
    const target=sessions.get(body.to);if(!target||target.table!==s.table||target.role===s.role)throw Error('Destinació no vàlida');
    const type=body.type,payload=body.payload;if(!['offer','answer','candidate'].includes(type)||((type==='offer')!==(s.role==='publisher')&&type!=='candidate'))throw Error('Missatge no permès');
    if(JSON.stringify(payload).length>100000)throw Error('Missatge massa gran');
    if(type==='candidate'&&(!payload||typeof payload.candidate!=='string'))throw Error('Candidat no vàlid');
    if(type!=='candidate'&&(!payload||payload.type!==type||typeof payload.sdp!=='string'))throw Error('Descripció no vàlida');
    send(target,{type,from:s.id,payload});sendJson(res,200,{ok:true});return true;
   }
   sendJson(res,404,{error:'Ruta no trobada'});
  }catch(error){sendJson(res,400,{error:error.message||'Petició no vàlida'})}return true;
 };
 route.closePublicViewers=()=>{for(const session of [...sessions.values()])if(session.role==='viewer'&&!session.admin)close(session)};
 return route;
};
