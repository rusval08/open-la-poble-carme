(function(){
 'use strict';if(!document.body.classList.contains('tv-directe-body'))return;
 const style=document.createElement('style');style.textContent='.mobile-live-play{position:absolute;z-index:30;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 16px!important;border:1px solid #c6a565!important;border-radius:0!important;background:#091d2aee!important;color:#fff!important;font:600 13px Arial!important;max-width:85%;cursor:pointer}.mobile-live-play[hidden]{display:none!important}';document.head.append(style);
 const watched=new WeakMap();let observer;
 function attach(video){if(watched.has(video))return;watched.set(video,()=>{});video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.muted=true;video.defaultMuted=true;video.setAttribute('muted','');
 const container=video.closest('.tv-video-container,.cpool-dvr-player');if(!container)return;const button=document.createElement('button');button.className='mobile-live-play';button.type='button';button.textContent='▶ Toca per veure el directe';button.hidden=true;container.append(button);
 function show(){if(video.isConnected&&video.paused)button.hidden=false}
 function attempt(){if(!video.isConnected||document.hidden||(!video.srcObject&&!video.currentSrc))return;video.play().then(()=>{button.hidden=true}).catch(show)}
 button.addEventListener('click',attempt);video.addEventListener('loadeddata',attempt);video.addEventListener('canplay',attempt);video.addEventListener('playing',()=>{button.hidden=true});video.addEventListener('pause',show);watched.set(video,attempt);attempt();
 }
 function scan(){document.querySelectorAll('.tv-video video').forEach(attach)}document.addEventListener('visibilitychange',()=>{if(!document.hidden)document.querySelectorAll('.tv-video video').forEach(v=>watched.get(v)?.())});
 observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});scan();addEventListener('pagehide',()=>observer.disconnect());addEventListener('pageshow',()=>{observer.observe(document.body,{childList:true,subtree:true});scan()});
})();
