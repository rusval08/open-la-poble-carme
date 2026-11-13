(function(){
 'use strict';const main=document.querySelector('.admin-layout');if(!main)return;
 const panel=document.createElement('section');panel.className='broadcast-gate-panel';
 panel.innerHTML='<div><p class="eyebrow">VISIBILITAT DE LES DUES TV TABLE</p><h2>Càmeres al públic</h2><p class="broadcast-gate-state" role="status">Comprovant l’estat…</p></div><p>Fes les proves amb les pantalles públiques tancades. L’administrador pot continuar previsualitzant les càmeres.</p><a class="broadcast-preview-link" href="/tv-directe.html?preview=admin" target="_blank" rel="noopener">Obrir previsualització d’administrador ↗</a><button type="button" class="broadcast-gate-toggle">Activar càmeres al públic</button><form class="broadcast-pin-form" hidden><label>PIN de seguretat<input type="password" minlength="1" maxlength="128" autocomplete="off" required></label><div><button type="submit">Confirmar</button><button type="button" class="broadcast-gate-cancel">Cancel·lar</button></div></form><p class="broadcast-gate-message" role="alert"></p>';
 main.prepend(panel);const button=panel.querySelector('.broadcast-gate-toggle'),form=panel.querySelector('form'),pin=form.querySelector('input'),message=panel.querySelector('[role=alert]');let state=null,requested=null,busy=false,expired=false,inflight=null,timer,messageKind='';
 function show(next){
  document.querySelectorAll('a[href^="/tv-directe.html"]').forEach(a=>{const u=new URL(a.href);u.searchParams.set('preview','admin');a.href=u.href});
  state=next;panel.dataset.open=String(next.open);panel.querySelector('.broadcast-gate-state').textContent=next.open?'PÚBLIC OBERT · Les dues TV Table són visibles':'PÚBLIC TANCAT · Proves privades de l’administrador';
  window.dispatchEvent(new CustomEvent('cpool-admin-public-gate',{detail:next}));
  button.textContent=next.open?'Desactivar càmeres del públic':'Activar càmeres al públic';button.disabled=busy;
  document.querySelectorAll('.live-publish').forEach(b=>b.textContent=next.open?'Emetre USB al públic':'Iniciar emissió de prova privada');
 }
 async function refresh(){
  if(busy)return false;if(inflight)return inflight;
  inflight=(async()=>{
   try{
    const r=await fetch('/api/broadcast-visibility',{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw Error('No es pot comprovar la connexió. Prem el botó per reintentar-ho.');
    const data=await r.json();
    if(data.adminPreview!==true){expired=true;requested=null;pin.value='';form.hidden=true;button.textContent='Tornar a iniciar sessió';button.disabled=false;messageKind='connection';message.textContent='La sessió d’administrador ha caducat. Prem el botó per tornar a entrar.';return false}
    expired=false;show(data);if(messageKind==='connection'){message.textContent='';messageKind=''}return true;
   }catch(e){
    messageKind='connection';message.textContent=e.name==='TimeoutError'?'La connexió tarda a respondre. Prem el botó per reintentar-ho.':e.message;
    button.disabled=false;if(!state)button.textContent='Reintentar connexió';return false;
   }
  })();
  try{return await inflight}finally{inflight=null}
 }
 button.addEventListener('click',async()=>{
  if(busy)return;button.setAttribute('aria-busy','true');const ready=await refresh();button.setAttribute('aria-busy','false');
  if(!ready){if(expired)location.href='/login?next=%2Fadmin';return}
  requested={open:!state.open,revision:state.revision};form.hidden=false;form.querySelector('[type=submit]').textContent=requested.open?'Activar amb PIN':'Tancar amb PIN';message.textContent='';messageKind='';pin.value='';pin.focus();
 });
 panel.querySelector('.broadcast-gate-cancel').addEventListener('click',()=>{pin.value='';requested=null;form.hidden=true;button.focus()});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!requested)return;busy=true;button.disabled=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{
   const r=await fetch('/api/broadcast-visibility',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...requested,pin:pin.value}),signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Error(data.error||'No s’ha pogut canviar la visibilitat');
   show(data);form.hidden=true;requested=null;messageKind='result';message.textContent=data.open?'Emissió pública activada.':'Emissió pública tancada. Pots continuar fent proves privades.';
  }catch(e){messageKind='result';message.textContent=e.name==='TimeoutError'?'No s’ha rebut confirmació. Comprova l’estat abans de repetir l’acció.':e.message}
  finally{pin.value='';busy=false;button.disabled=false;submit.disabled=false;await refresh()}
 });
 function start(){clearInterval(timer);refresh();timer=setInterval(refresh,5000)}
 addEventListener('pageshow',start);addEventListener('online',()=>refresh());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});addEventListener('pagehide',()=>clearInterval(timer));start();
})();
