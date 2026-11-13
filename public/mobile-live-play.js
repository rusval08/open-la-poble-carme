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
