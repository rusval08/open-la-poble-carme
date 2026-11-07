(function(){
 'use strict';
 const cards=[...document.querySelectorAll('.tv-camera-card')];
 if(!cards.length)return;
 const entries=cards.map(card=>{
  const bar=document.createElement('div');bar.className='tv-mobile-transport';bar.setAttribute('aria-label','Controls de vídeo de la taula '+card.dataset.camera);
  bar.innerHTML='<div class="tv-mobile-transport-buttons"><button type="button" data-move="-10" aria-label="Retrocedir deu segons" disabled>−10 s</button><button type="button" data-move="10" aria-label="Avançar deu segons" disabled>+10 s</button><button type="button" data-move="live" aria-label="Tornar al directe" disabled>LIVE</button></div><p role="status">En espera de vídeo. Els controls s’activaran quan comenci l’emissió.</p>';
  card.querySelector('.tv-video').after(bar);
  function current(){return card.querySelector('.tv-video video')}
  function range(video){if(!video?.seekable?.length)return null;return {start:video.seekable.start(0),end:video.seekable.end(video.seekable.length-1)}}
  bar.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button||button.disabled)return;
   const video=current(),r=range(video);if(!video)return;
   if(button.dataset.move==='live'){if(r)video.currentTime=Math.max(r.start,r.end-2);video.play().catch(()=>{});return}
   if(r)video.currentTime=Math.max(r.start,Math.min(r.end-.25,video.currentTime+Number(button.dataset.move)));
  });
  return {card,bar,current,range};
 });
 function update(){for(const {card,bar,current,range} of entries){
  bar.hidden=!!card.querySelector('.cpool-dvr-player');
  if(bar.hidden)continue;
  const video=current(),r=range(video),ready=!!video&&(video.readyState>=2||!!video.srcObject);
  bar.querySelectorAll('[data-move]').forEach(b=>{b.disabled=b.dataset.move==='live'?!ready:!r});
  const text=!ready?'En espera de vídeo. Els controls s’activaran quan comenci l’emissió.':r?'Pots avançar, retrocedir o tornar al directe.':'Directe immediat: aquesta emissió no té retrocés. Cal emetre amb DVR.';
  const status=bar.querySelector('p');if(status.textContent!==text)status.textContent=text;
 }}
 let timer;function start(){clearInterval(timer);update();timer=setInterval(update,1000)}
 addEventListener('pagehide',()=>clearInterval(timer));addEventListener('pageshow',start);start();
})();
