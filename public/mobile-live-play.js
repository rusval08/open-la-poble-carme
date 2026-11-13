(function(){
 'use strict';if(!document.body.classList.contains('tv-directe-body'))return;
 const style=document.createElement('style');style.textContent='.mobile-live-play{position:absolute;z-index:30;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 16px!important;border:1px solid #c6a565!important;border-radius:0!important;background:#091d2aee!important;color:#fff!important;font:600 13px Arial!important;max-width:85%;cursor:pointer}.mobile-live-play[hidden]{display:none!important}';document.head.append(style);
 const watched=new WeakMap();
 function attach(video){
  const container=video.closest('.tv-video-container,.cpool-dvr-player');if(!container)return;
  const previous=watched.get(video);if(previous){if(previous.button.parentElement!==container)container.append(previous.button);return}
  video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.muted=true;video.defaultMuted=true;video.setAttribute('muted','');
  const button=document.createElement('button');button.className='mobile-live-play';button.type='button';button.textContent='▶ Toca per veure el directe';button.hidden=true;container.append(button);let fallback;
  function show(){if(video.isConnected&&video.paused&&!document.hidden)button.hidden=false}
  function attempt(){
   if(!video.isConnected||document.hidden||(!video.srcObject&&!video.currentSrc))return;
   clearTimeout(fallback);fallback=setTimeout(show,1600);
   // Keep play() in the tap handler for iPhone/iPad when autoplay is blocked.
   try{const result=video.play();if(result?.then)result.then(()=>{clearTimeout(fallback);button.hidden=true}).catch(show)}catch{show()}
  }
  watched.set(video,{attempt,button});
  button.addEventListener('click',()=>{for(const v of document.querySelectorAll('.tv-video video'))watched.get(v)?.attempt()});
  video.addEventListener('loadeddata',attempt);video.addEventListener('canplay',attempt);video.addEventListener('playing',()=>{clearTimeout(fallback);button.hidden=true});video.addEventListener('pause',show);attempt();
 }
 function scan(){document.querySelectorAll('.tv-video video').forEach(attach)}
 function resume(){if(!document.hidden){scan();document.querySelectorAll('.tv-video video').forEach(v=>watched.get(v)?.attempt())}}
 document.addEventListener('visibilitychange',resume);addEventListener('online',resume);
 const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});scan();addEventListener('pagehide',()=>observer.disconnect());addEventListener('pageshow',()=>{observer.observe(document.body,{childList:true,subtree:true});resume()});
})();

(function(){
 'use strict';if(!document.body.classList.contains('tv-directe-body'))return;
 const controls=new Map();let active=null;
 function floating(video){return !!video&&(document.pictureInPictureElement===video||video.webkitPresentationMode==='picture-in-picture')}
 function support(video){return !!video&&(!!video.requestPictureInPicture&&document.pictureInPictureEnabled!==false||typeof video.webkitSetPresentationMode==='function'&&(!video.webkitSupportsPresentationMode||video.webkitSupportsPresentationMode('picture-in-picture')))}
 function update(){for(const [table,entry]of controls){const card=document.querySelector('#taula-'+table),video=card?.querySelector('video');entry.button.hidden=!!card?.hidden;entry.button.disabled=!video||video.readyState<2;const label=floating(video)?'Tornar el vídeo a la pàgina':'Vídeo flotant ↗';if(entry.button.textContent!==label)entry.button.textContent=label;entry.button.setAttribute('aria-pressed',String(floating(video)));if(active&&!floating(active)){active=null}}}
 function mount(){for(const table of[1,2]){const card=document.querySelector('#taula-'+table);if(!card||controls.has(table))continue;const bar=document.createElement('div');bar.className='tv-pip-tools';const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Vídeo flotant de la taula '+table);const status=document.createElement('span');status.setAttribute('role','status');bar.append(button,status);card.append(bar);controls.set(table,{button,status});button.addEventListener('click',async()=>{const video=card.querySelector('video');if(!video||video.readyState<2)return;status.textContent='';if(!support(video)){status.textContent='Aquest navegador no permet vídeo flotant. Prova el navegador del dispositiu.';return}try{if(floating(video)){if(document.pictureInPictureElement)await document.exitPictureInPicture();else video.webkitSetPresentationMode('inline');active=null}else{if(video.requestPictureInPicture&&document.pictureInPictureEnabled!==false)await video.requestPictureInPicture();else video.webkitSetPresentationMode('picture-in-picture');active=video;status.textContent='Pots canviar d’app o pestanya. Mantén aquesta pàgina oberta.'}update()}catch{status.textContent='No s’ha pogut obrir el vídeo flotant en aquest navegador.'}})}update()}
 const style=document.createElement('style');style.textContent='.tv-pip-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0}.tv-pip-tools button{border:1px solid #526879;border-radius:0;padding:7px 11px;background:#102b3c;color:#e2eaf0;font:600 12px Arial;cursor:pointer}.tv-pip-tools button:disabled{opacity:.5;cursor:default}.tv-pip-tools [role=status]{font:400 11px Arial;color:#bdcad3}.tv-pip-tools button[hidden]{display:none}@media(orientation:landscape) and (max-height:550px){body.tv-fullscreen-active .tv-pip-tools{position:absolute;right:12px;top:8px;z-index:40}}';document.head.append(style);
 document.addEventListener('enterpictureinpicture',update,true);document.addEventListener('leavepictureinpicture',update,true);document.addEventListener('webkitpresentationmodechanged',update,true);document.addEventListener('loadeddata',update,true);document.addEventListener('playing',update,true);
 // Keep the source page alive when following links with a floating video.
 document.addEventListener('click',event=>{if(!active||!floating(active))return;const a=event.target.closest('a[href]');if(a&&a.origin===location.origin&&!a.hash){a.target='_blank';a.rel='noopener noreferrer'}});
 new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});mount();
})();
