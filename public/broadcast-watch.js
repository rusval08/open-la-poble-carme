(function(){
 'use strict';let stopped=false,inflight=false,admin=false;const hold=document.body.dataset.broadcastHold==='true';window.CPoolBroadcastAllowed=false;window.CPoolAdminPreview=false;
 function stopMedia(){document.querySelectorAll('video').forEach(v=>{v.pause();v.srcObject=null;v.removeAttribute('src');v.load()});document.querySelectorAll('.tv-video iframe').forEach(f=>f.remove())}
 function apply(data){if(stopped)return;const open=data.open===true;admin=data.adminPreview===true;window.CPoolAdminPreview=admin;const before=window.CPoolBroadcastAllowed;window.CPoolBroadcastAllowed=open||admin;
  if(admin){let banner=document.querySelector('.broadcast-preview-banner');if(!banner){banner=document.createElement('div');banner.className='broadcast-preview-banner';banner.setAttribute('role','status');document.body.prepend(banner)}banner.textContent=open?'ADMINISTRADOR · Emissió pública oberta':'PREVISUALITZACIÓ PRIVADA · El públic no veu les TV Table'}
  if((hold&&(open||admin))||(!hold&&!open&&!admin)){stopped=true;stopMedia();location.reload();return}
  if(!before&&window.CPoolBroadcastAllowed){dispatchEvent(new Event('cpool-broadcast-access'));dispatchEvent(new Event('tv-local-camera-change'))}
 }
 async function check(){if(stopped||inflight)return;inflight=true;try{const r=await fetch('/api/broadcast-visibility',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();apply(await r.json())}catch{window.CPoolBroadcastAllowed=false;if(!hold){stopped=true;stopMedia();location.reload()}else{const status=document.querySelector('#broadcastHoldStatus');if(status)status.textContent='Reconnectant amb l’organització…'}}finally{inflight=false}}
 const events=new EventSource('/api/events');events.onmessage=event=>{try{const s=JSON.parse(event.data);if(s.settings?.publicBroadcast)check()}catch{}};events.onerror=check;
 const timer=setInterval(check,3000);addEventListener('online',check);addEventListener('pagehide',()=>{events.close();clearInterval(timer)});check();
})();
