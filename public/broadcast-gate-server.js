// Server-only public TV switch. PIN verification never runs in the browser.
const crypto=require('crypto'),fs=require('fs'),path=require('path');
module.exports=function createBroadcastGate({isAdmin,readBody,sendJson,dataDir,onChange,pinHash}){
 const file=path.join(dataDir,'public-broadcast.json'),attempts=new Map();
 // A process restart always returns to private rehearsal, even without a disk.
 let current={open:false,revision:crypto.randomUUID(),updatedAt:Date.now()};
 function status(){return {...current}}
 function allowed(req){return current.open||isAdmin(req)}
 function digest(value){return crypto.createHash('sha256').update(String(value)).digest()}
 const expected=/^[a-f0-9]{64}$/i.test(pinHash||'')?Buffer.from(pinHash,'hex'):null;
 async function route(req,res,url){
  if(url.pathname!=='/api/broadcast-visibility')return false;
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'){sendJson(res,200,{...status(),adminPreview:isAdmin(req),pinConfigured:!!expected});return true}
  if(req.method!=='POST'){sendJson(res,405,{error:'Mètode no permès'});return true}
  if(!isAdmin(req)){sendJson(res,401,{error:'Cal iniciar sessió com a administrador'});return true}
  if(!expected){sendJson(res,503,{error:'Cal configurar el PIN de seguretat al servei de Render'});return true}
  const key=digest(req.headers.cookie||req.socket.remoteAddress||'').toString('hex'),now=Date.now();
  for(const[k,v]of attempts)if(v.until<=now)attempts.delete(k);
  if((attempts.get(key)?.count||0)>=5){res.setHeader('Retry-After','900');sendJson(res,429,{error:'Massa intents de PIN. Espera 15 minuts.'});return true}
  try{
   const body=JSON.parse(await readBody(req,2048)||'{}');
   if(typeof body.open!=='boolean'||typeof body.pin!=='string'){sendJson(res,400,{error:'Indica l’acció i el PIN de seguretat'});return true}
   if(!crypto.timingSafeEqual(digest(body.pin),expected)){
    if(attempts.size>=10000&&!attempts.has(key))attempts.delete(attempts.keys().next().value);
    const failed=attempts.get(key)||{count:0,until:now+15*60*1000};failed.count++;attempts.set(key,failed);
    sendJson(res,403,{error:'PIN de seguretat incorrecte'});return true;
   }
   if(body.revision!==current.revision){sendJson(res,409,{error:'L’estat ha canviat en un altre dispositiu. Revisa’l i torna-ho a provar.'});return true}
   if(body.open!==current.open){
    const next={open:body.open,revision:crypto.randomUUID(),updatedAt:Date.now()},temporary=file+'.tmp';
    try{fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(temporary,JSON.stringify(next),{mode:0o600});fs.renameSync(temporary,file)}catch{try{fs.unlinkSync(temporary)}catch{}sendJson(res,507,{error:'No s’ha pogut guardar el canvi. Les pantalles mantenen l’estat anterior.'});return true}
    current=next;onChange();
   }
   attempts.delete(key);sendJson(res,200,status());
  }catch(error){sendJson(res,error.statusCode||400,{error:error.statusCode?error.message:'Petició no vàlida'})}
  return true;
 }
 return {status,allowed,route};
};
