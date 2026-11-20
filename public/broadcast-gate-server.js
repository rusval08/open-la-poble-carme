// Server-only public TV switch, controlled by the administrator session.
const crypto=require('crypto'),fs=require('fs'),path=require('path');
module.exports=function createBroadcastGate({isAdmin,readBody,sendJson,dataDir,onChange}){
 const file=path.join(dataDir,'public-broadcast.json');
 // A process restart always returns to private rehearsal, even without a disk.
 let current={open:false,revision:crypto.randomUUID(),updatedAt:Date.now()};
 function status(){return {...current}}
 function allowed(req){return current.open||isAdmin(req)}
 async function route(req,res,url){
  if(url.pathname!=='/api/broadcast-visibility')return false;
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'){sendJson(res,200,{...status(),adminPreview:isAdmin(req)});return true}
  if(req.method!=='POST'){sendJson(res,405,{error:'Mètode no permès'});return true}
  if(!isAdmin(req)){sendJson(res,401,{error:'Cal iniciar sessió com a administrador'});return true}
  try{
   const body=JSON.parse(await readBody(req,2048)||'{}');
   if(typeof body.open!=='boolean'){sendJson(res,400,{error:'Indica si vols obrir o tancar el directe'});return true}
   if(body.revision!==current.revision){sendJson(res,409,{error:'L’estat ha canviat en un altre dispositiu. Revisa’l i torna-ho a provar.'});return true}
   if(body.open!==current.open){
    const next={open:body.open,revision:crypto.randomUUID(),updatedAt:Date.now()},temporary=file+'.tmp';
    try{fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(temporary,JSON.stringify(next),{mode:0o600});fs.renameSync(temporary,file)}catch{try{fs.unlinkSync(temporary)}catch{}sendJson(res,507,{error:'No s’ha pogut guardar el canvi. Les pantalles mantenen l’estat anterior.'});return true}
    current=next;onChange();
   }
   sendJson(res,200,status());
  }catch(error){sendJson(res,error.statusCode||400,{error:error.statusCode?error.message:'Petició no vàlida'})}
  return true;
 }
 return {status,allowed,route};
};
