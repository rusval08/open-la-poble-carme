(function(){
 'use strict';
 const cards=[...document.querySelectorAll('.tv-camera-card')];
 if(!cards.length)return;
 const entries=cards.map(card=>{
  const bar=document.createElement('div');bar.className='tv-mobile-transport';bar.setAttribute('aria-label','Controls de vídeo de la taula '+card.dataset.camera);
  bar.innerHTML='<input class="tv-mobile-seek" type="range" min="0" max="1" step="0.1" value="0" aria-label="Desplaçar el vídeo" disabled><div class="tv-mobile-timeline-info"><span class="tv-mobile-delay">En espera</span><button type="button" data-move="live" disabled>● EN DIRECTE</button></div><p role="status">En espera de vídeo.</p>';
  card.querySelector('.tv-video').after(bar);
  let scrubbing=false;const seek=bar.querySelector('input');
  seek.addEventListener('input',()=>{scrubbing=true;document.body.classList.add('tv-scrubbing');window.TVScreen?.reveal()});
  seek.addEventListener('change',()=>{const video=current(),r=range(video);if(r)video.currentTime=Math.max(r.start,Math.min(r.end-.25,Number(seek.value)));scrubbing=false;document.body.classList.remove('tv-scrubbing');window.TVScreen?.reveal()});
  seek.addEventListener('pointercancel',()=>{scrubbing=false});
  function current(){return card.querySelector('.tv-video video')}
  function range(video){if(!video?.seekable?.length)return null;return {start:video.seekable.start(0),end:video.seekable.end(video.seekable.length-1)}}
  bar.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button||button.disabled)return;
   const video=current(),r=range(video);if(!video)return;
   if(button.dataset.move==='live'){if(r)video.currentTime=Math.max(r.start,r.end-2);video.play().catch(()=>{});return}
   if(r)video.currentTime=Math.max(r.start,Math.min(r.end-.25,video.currentTime+Number(button.dataset.move)));
  });
  return {card,bar,current,range,seek,isScrubbing:()=>scrubbing};
 });
 function update(){for(const {card,bar,current,range,seek,isScrubbing} of entries){
  bar.hidden=!!card.querySelector('.cpool-dvr-player');
  if(bar.hidden)continue;
  const video=current(),r=range(video),ready=!!video&&(video.readyState>=2||!!video.srcObject);
  seek.disabled=!r;if(r){seek.min=r.start;seek.max=r.end;if(!isScrubbing())seek.value=Math.max(r.start,Math.min(r.end,video.currentTime));const behind=Math.max(0,r.end-video.currentTime);seek.style.setProperty('--played',Math.max(0,Math.min(100,(Number(seek.value)-r.start)/(r.end-r.start||1)*100))+'%');seek.setAttribute('aria-valuetext',behind<5?'En directe':Math.round(behind)+' segons enrere');bar.querySelector('.tv-mobile-delay').textContent=behind<5?'Ara':'−'+Math.floor(behind/60)+':'+String(Math.floor(behind%60)).padStart(2,'0');bar.querySelector('button').classList.toggle('at-live',behind<5)}else bar.querySelector('.tv-mobile-delay').textContent=ready?'Directe':'En espera';
  bar.querySelectorAll('[data-move]').forEach(b=>{b.disabled=!r});
  const text=!ready?'En espera de vídeo. Els controls s’activaran quan comenci l’emissió.':r?'':'Directe immediat: aquesta emissió no té retrocés. Cal emetre amb DVR.';
  const status=bar.querySelector('p');if(status.textContent!==text)status.textContent=text;status.hidden=!text;
 }}
 let timer;function start(){clearInterval(timer);update();timer=setInterval(update,1000)}
 addEventListener('pagehide',()=>clearInterval(timer));addEventListener('pageshow',start);start();
})();
