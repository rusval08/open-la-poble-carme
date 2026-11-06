// Server-only module. Never served to browsers.
const crypto=require('crypto');
module.exports=function createGuard(){
 const secret=crypto.randomBytes(32),attempts=new Map(),revoked=new Map(),ttl=12*60*60*1000;
 function token(role){const payload=role+'.'+Date.now()+'.'+crypto.randomBytes(16).toString('hex');return payload+'.'+crypto.createHmac('sha256',secret).update(payload).digest('hex')}
 function valid(value,role){for(const[k,t]of revoked)if(t<Date.now())revoked.delete(k);if(revoked.has(value))return false;if(typeof value!=='string'||value.length>240)return false;const parts=value.split('.');if(parts.length!==4||parts[0]!==role||!/^\d+$/.test(parts[1])||!/^[a-f0-9]{32}$/.test(parts[2])||!/^[a-f0-9]{64}$/.test(parts[3]))return false;const age=Date.now()-Number(parts[1]);if(age<0||age>ttl)return false;const sig=crypto.createHmac('sha256',secret).update(parts.slice(0,3).join('.')).digest();return crypto.timingSafeEqual(sig,Buffer.from(parts[3],'hex'))}
 function equal(a,b){return crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(),crypto.createHash('sha256').update(String(b)).digest())}
 function cookie(req,res,name,value,clear=false){const secure=req.socket.encrypted||String(req.headers['x-forwarded-proto']||'').split(',')[0]==='https'||process.env.RENDER==='true';const c=name+'='+encodeURIComponent(value)+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+(clear?0:ttl/1000)+(secure?'; Secure':'');const prev=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',[...(Array.isArray(prev)?prev:prev?[prev]:[]),c])}
 function begin(req,res){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('X-CPool-App','1');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  if(!['GET','HEAD','POST'].includes(req.method))return{status:405,error:'Mètode no permès'};
  if(req.method==='POST'){const host=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();if(req.headers['sec-fetch-site']==='cross-site')return{status:403,error:'Origen no permès'};if(req.headers.origin){try{if(new URL(req.headers.origin).host!==host)return{status:403,error:'Origen no permès'}}catch{return{status:403,error:'Origen no permès'}}}
   if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return{status:415,error:'Cal enviar JSON'};
  }return null;
 }
 function key(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',').at(-1).trim()}
 function limited(req){const k=key(req),now=Date.now();for(const[id,v]of attempts)if(v.until<now)attempts.delete(id);return(attempts.get(k)?.count||0)>=10}
 function failed(req){const k=key(req);if(attempts.size>=10000&&!attempts.has(k))attempts.delete(attempts.keys().next().value);const v=attempts.get(k)||{count:0,until:Date.now()+15*60*1000};v.count++;attempts.set(k,v)}
 function succeeded(req){attempts.delete(key(req))}
 function revoke(value,role){if(valid(value,role)){if(revoked.size>=10000)revoked.delete(revoked.keys().next().value);revoked.set(value,Date.now()+ttl)}}
 return{token,valid,equal,cookie,begin,limited,failed,succeeded,revoke};
};
