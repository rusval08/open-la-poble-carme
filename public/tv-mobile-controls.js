(function(){
 'use strict';
 const entries=[...document.querySelectorAll('.tv-camera-card')].map(card=>{
  const bar=document.createElement('div');bar.className='tv-mobile-transport';bar.setAttribute('aria-label','Reproductor de la taula '+card.dataset.camera);
  bar.innerHTML='<input class="tv-mobile-seek" type="range" min="0" max="1" step="0.1" value="0" aria-label="Desplaçar el vídeo" hidden><div class="tv-mobile-timeline-info"><span class="tv-mobile-delay">EN ESPERA</span><button type="button" data-move="live" disabled>DIRECTE</button></div>';
  card.querySelector('.tv-video').after(bar);let scrubbing=false;
  const seek=bar.querySelector('input'),label=bar.querySelector('.tv-mobile-delay'),live=bar.querySelector('button');
  const current=()=>card.querySelector('.tv-video video');
  function range(video){if(!video?.seekable?.length)return null;const start=video.seekable.start(0),end=video.seekable.end(video.seekable.length-1);return end-start>1?{start,end}:null}
  seek.addEventListener('input',()=>{scrubbing=true;document.body.classList.add('tv-scrubbing');window.TVScreen?.reveal()});
  function release(){scrubbing=false;document.body.classList.remove('tv-scrubbing');window.TVScreen?.reveal()}
  seek.addEventListener('change',()=>{const video=current(),r=range(video);if(r)video.currentTime=Math.max(r.start,Math.min(r.end-.25,Number(seek.value)));release()});seek.addEventListener('pointercancel',release);
  live.addEventListener('click',()=>{const video=current(),r=range(video);if(!video)return;if(r)video.currentTime=Math.max(r.start,r.end-2);video.play().catch(()=>{});window.TVScreen?.reveal()});
  return{card,bar,current,range,seek,label,live,scrubbing:()=>scrubbing};
 });
 function text(node,value){if(node.textContent!==value)node.textContent=value}
 function update(){for(const e of entries){const {card,bar,current,range,seek,label,live}=e;bar.hidden=!!card.hidden||!!card.querySelector('.cpool-dvr-player,.tv-video iframe');if(bar.hidden)continue;
   const video=current(),r=range(video),ready=!!video&&video.readyState>=2&&video.videoWidth>0;
   const recovering=video?.dataset.reconnecting==='true'||navigator.onLine===false;
   const state=recovering?'reconnecting':!ready?'waiting':video.paused?'paused':'live';bar.dataset.state=state;
   seek.hidden=!r;seek.disabled=!r;live.disabled=!ready||recovering;
   let delay=0;if(r){seek.min=r.start;seek.max=r.end;if(!e.scrubbing())seek.value=Math.max(r.start,Math.min(r.end,video.currentTime));delay=Math.max(0,r.end-video.currentTime);seek.style.setProperty('--played',Math.max(0,Math.min(100,(Number(seek.value)-r.start)/(r.end-r.start)*100))+'%');seek.setAttribute('aria-valuetext',delay<5?'En directe':Math.round(delay)+' segons enrere')}
   text(label,state==='reconnecting'?'RECONNECTANT':state==='waiting'?'EN ESPERA':state==='paused'?'EN PAUSA':delay>=5?'−'+Math.floor(delay/60)+':'+String(Math.floor(delay%60)).padStart(2,'0'):'EN DIRECTE');
   live.classList.toggle('at-live',state==='live'&&delay<5);text(live,state==='paused'?'REPRENDRE':r&&delay>=5?'TORNAR AL DIRECTE':'DIRECTE');
  }}
 let timer;function start(){clearInterval(timer);update();timer=setInterval(update,1000)}
 addEventListener('online',update);addEventListener('offline',update);addEventListener('tv-local-camera-change',update);addEventListener('pagehide',()=>clearInterval(timer));addEventListener('pageshow',start);start();
})();
