(function(){
 'use strict';
 async function post(path,body,signal){const response=await fetch('/api/live/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'No es pot connectar'),{status:response.status});return value}
 class Connection{
  constructor(role,table,stream,onStream,onStatus){Object.assign(this,{role,table,stream,onStream,onStatus,peers:new Map(),closed:false,abort:new AbortController()})}
  async start(){this.session=await post('session',{role:this.role,table:this.table},this.abort.signal);this.onStatus?.('Emissió preparada · esperant espectadors');this.poll();return this}
  async signal(to,type,payload){if(!this.closed)await post('signal',{...this.session,to,type,payload},this.abort.signal)}
  async peer(id){if(this.peers.has(id))return this.peers.get(id);const pc=new RTCPeerConnection(this.session.configuration),entry={pc,candidates:[]};this.peers.set(id,entry);if(this.stream)for(const track of this.stream.getVideoTracks())pc.addTrack(track,this.stream);
   pc.onicecandidate=event=>{if(event.candidate)this.signal(id,'candidate',event.candidate.toJSON()).catch(()=>{})};
   pc.ontrack=event=>this.onStream?.(event.streams[0]||new MediaStream([event.track]));
   pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')this.report();else if(['failed','closed'].includes(pc.connectionState)){this.drop(id);this.onStatus?.('Connexió interrompuda. Reconnectant…');if(this.role==='viewer')this.close()}};
   if(this.role==='publisher'){const offer=await pc.createOffer();await pc.setLocalDescription(offer);await this.signal(id,'offer',pc.localDescription.toJSON())}return entry;
  }
  report(){const count=[...this.peers.values()].filter(p=>p.pc.connectionState==='connected').length;this.onStatus?.(this.role==='publisher'?'Emetent · '+count+' espectadors connectats':'Vídeo USB en directe · connexió establerta')}
  drop(id){const p=this.peers.get(id);this.peers.delete(id);if(p){p.pc.onconnectionstatechange=null;p.pc.close()}}
  async message(m){if(m.type==='offline'){this.close();return}if(m.type==='leave'){this.drop(m.from);this.report();return}if(m.type==='join'){await this.peer(m.from);return}const p=await this.peer(m.from);if(m.type==='candidate'){if(p.pc.remoteDescription)await p.pc.addIceCandidate(m.payload);else p.candidates.push(m.payload);return}await p.pc.setRemoteDescription(m.payload);for(const candidate of p.candidates.splice(0))await p.pc.addIceCandidate(candidate);if(m.type==='offer'){await p.pc.setLocalDescription(await p.pc.createAnswer());await this.signal(m.from,'answer',p.pc.localDescription.toJSON())}}
  async poll(){while(!this.closed){try{const data=await post('poll',this.session,this.abort.signal);for(const message of data.messages)await this.message(message);if(!this.closed)await new Promise(resolve=>setTimeout(resolve,1000))}catch(error){if(this.closed)break;this.onStatus?.(error.status===401?'Emissió aturada o sessió caducada':error.message);this.close();break}}}
  close(){if(this.closed)return;try{this.onBeforeClose?.()}catch{}this.closed=true;this.abort.abort();for(const id of this.peers.keys())this.drop(id);if(this.session)fetch('/api/live/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.session),keepalive:true}).catch(()=>{});this.onClose?.()}
 }
 window.ChampionshipLive={Connection};
 if(!window.RTCPeerConnection)return;
 const publishers=new Map();
 if(document.body.classList.contains('admin-body')){
  const controllers=new Map();let wakeLock=null,wakePending=false;
  async function keepAwake(){const active=[...controllers.values()].some(c=>c.wanted);if(!active){if(wakeLock){const lock=wakeLock;wakeLock=null;await lock.release().catch(()=>{})}return}if(document.hidden||wakeLock||wakePending||!navigator.wakeLock)return;wakePending=true;try{const lock=await navigator.wakeLock.request('screen');if(![...controllers.values()].some(c=>c.wanted)){await lock.release();return}wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null})}catch{}finally{wakePending=false}}
  for(const table of[1,2]){const card=document.querySelector('.production-camera[data-table="'+table+'"]');if(!card)continue;const box=document.createElement('div');box.className='live-broadcast-controls';box.innerHTML='<button type="button" class="live-publish">Iniciar directe per al públic</button><button type="button" class="live-stop" hidden>Aturar emissió</button><p role="status" class="live-broadcast-status">Emissió aturada</p><p class="production-note">Reconnexió automàtica activada. Mantén Administració i l’ordinador oberts durant el directe.</p>';card.querySelector('.production-preview').after(box);const start=box.querySelector('.live-publish'),stop=box.querySelector('.live-stop'),status=box.querySelector('[role=status]');
   if(!window.CPoolPublisherRecovery){status.textContent='Recarrega Administració per carregar la recuperació del directe.';start.disabled=true;continue}
   const controller=window.CPoolPublisherRecovery.create({getStream:()=>window.AdminCameraPreview?.stream(table),connect:async(stream,onStatus)=>(window.CPoolSimpleCameras?null:await window.DVRStream?.publisher(table,stream,onStatus))||await window.CloudStream?.connection('publisher',table,stream,null,onStatus)||new Connection('publisher',table,stream,null,onStatus),status:text=>status.textContent=text,changed:info=>{const {wanted}=info;start.hidden=wanted;stop.hidden=!wanted;box.dataset.reconnecting=String(wanted);window.dispatchEvent(new CustomEvent('cpool-publisher-state',{detail:{table,...info}}));keepAwake()}});controllers.set(table,controller);
   start.addEventListener('click',()=>{if(!window.AdminCameraPreview?.stream(table)?.getVideoTracks().some(t=>t.readyState==='live')){status.textContent='Primer previsualitza o connecta la càmera USB d’aquesta taula.';return}controller.start()});stop.addEventListener('click',()=>controller.stop());
  }
  window.CPoolCameraBroadcast={start:table=>controllers.get(Number(table))?.start(),stop:table=>controllers.get(Number(table))?.stop(),wanted:table=>controllers.get(Number(table))?.wanted===true};
  window.addEventListener('cpool-preview-stopped',event=>controllers.get(event.detail.table)?.stop('Càmera aturada per l’administrador'));
  window.addEventListener('online',()=>{for(const c of controllers.values())c.retry();keepAwake()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){for(const c of controllers.values())c.retry();keepAwake()}});
  window.addEventListener('pagehide',()=>{for(const c of controllers.values())c.stop('Administració tancada · Emissió aturada')});
 }else if(document.body.classList.contains('tv-directe-body')){
  const remote=new Map(),connections=new Map(),pending=new Map(),connecting=new Map(),staged=new Map(),frozen=new Map(),lastFrames=new Map(),original=window.LocalTVCamera;let profiles={},leaving=false;
  function announce(){window.dispatchEvent(new Event('tv-local-camera-change'))}
  function allowed(table){const card=document.querySelector('#taula-'+table);return window.CPoolBroadcastAllowed===true&&!leaving&&!window.DVRStream?.enabled(table)&&card&&!card.hidden}
  function clearFrame(table){const entry=frozen.get(table);entry?.canvas.remove();frozen.delete(table);const video=remote.get(table);if(video)video.dataset.reconnecting='false'}
  function rememberFrame(table,video){
   if(!video||video.readyState<2||!video.videoWidth||frozen.has(table))return;
   try{let entry=lastFrames.get(table);const canvas=entry?.canvas||document.createElement('canvas');const width=Math.min(960,video.videoWidth),height=Math.round(width*video.videoHeight/video.videoWidth);if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;canvas.getContext('2d').drawImage(video,0,0,width,height);lastFrames.set(table,{canvas,video})}catch{}
  }
  function holdFrame(table){
   if(!allowed(table))return;const video=remote.get(table);if(!video)return;
   if(!frozen.has(table)){try{if(lastFrames.get(table)?.video!==video)rememberFrame(table,video);const canvas=lastFrames.get(table)?.canvas;if(canvas){canvas.className='tv-reconnect-frame';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'contain',zIndex:'1',pointerEvents:'none'});if(window.getComputedStyle){const css=getComputedStyle(video);for(const key of ['filter','transform','transformOrigin','objectFit','objectPosition'])canvas.style[key]=css[key]}video.parentElement?.append(canvas);frozen.set(table,{canvas,time:video.currentTime})}}catch{}}
   video.dataset.reconnecting='true';announce();const status=document.querySelector('#tvLiveStatus'+table);if(status)status.textContent=navigator.onLine===false?'Sense connexió · Es reprendrà quan torni internet':'Connexió interrompuda · Reconnectant el vídeo…';
  }
  function discardStaged(table,owner){const video=staged.get(table);if(!video||owner&&video.cpoolConnection!==owner)return;video.onloadeddata=null;video.onplaying=null;video.oncanplay=null;video.pause();video.srcObject=null;video.remove();staged.delete(table)}
  window.LocalTVCamera={setPicture(production){profiles=production||{};original?.setPicture(production);for(const[id,video]of remote)window.USBPicture?.style(video,profiles[id]?.picture||{})},active:id=>remote.has(id)||original?.active(id),render(camera){const video=remote.get(camera.id);if(!video)return original?.render(camera)||false;if(video.parentElement!==camera.container)camera.container.replaceChildren(video);const image=frozen.get(camera.id)?.canvas;if(image&&image.parentElement!==camera.container)camera.container.append(image);camera.loadedId='remote:'+camera.id;if(video.dataset.reconnecting!=='true')video.play().catch(()=>{});return true}};
  window.RemoteTVCamera={active:id=>remote.has(id),reconnecting:id=>remote.get(id)?.dataset.reconnecting==='true'};
  async function connect(table){
   if(!allowed(table)||pending.has(table)||connections.has(table)||original?.active(table))return;
   const token={};pending.set(table,token);let connection;
   try{
    const onStream=stream=>{
     if(!allowed(table)||connection?.closed||pending.get(table)!==token&&connections.get(table)!==connection)return;
     const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;video.defaultMuted=true;for(const name of ['muted','playsinline','webkit-playsinline'])video.setAttribute(name,'');video.className='tv-usb-video';video.srcObject=stream;video.cpoolConnection=connection;if(connection)connection.video=video;window.USBPicture?.style(video,profiles[table]?.picture||{});
     discardStaged(table);staged.set(table,video);Object.assign(video.style,{position:'absolute',inset:'0',opacity:'1',pointerEvents:'none'});document.querySelector('#tvVideoContainer'+table)?.append(video);
     const commit=()=>{if(!allowed(table)||connection?.closed||staged.get(table)!==video||video.readyState<2||!video.videoWidth)return;staged.delete(table);video.onloadeddata=null;video.onplaying=null;video.oncanplay=null;for(const key of ['position','inset','opacity','pointer-events'])video.style.removeProperty(key);clearFrame(table);video.dataset.reconnecting='false';const target=video.parentElement;target?.replaceChildren(video);remote.set(table,video);rememberFrame(table,video);if(connection)connection.lastFrame=Date.now();announce()};
     video.onloadeddata=commit;video.onplaying=commit;video.oncanplay=commit;
     video.addEventListener('timeupdate',()=>{const image=frozen.get(table),active=connections.get(table);if(image&&active?.video===video&&!active.closed&&active.usesDecodedStats!==true&&Math.abs(video.currentTime-image.time)>.05){clearFrame(table);announce()}});
     video.play().then(commit).catch(()=>{});
    };
    const onStatus=text=>{const el=document.querySelector('#tvLiveStatus'+table);if(el&&!remote.has(table)&&!original?.active(table))el.textContent=text};
    connection=await window.CloudStream?.connection('viewer',table,null,onStream,onStatus)||new Connection('viewer',table,null,onStream,onStatus);
    if(!allowed(table)||pending.get(table)!==token){connection.close();return}
    connecting.set(table,connection);
    connection.onBeforeClose=()=>{if(connections.get(table)===connection)holdFrame(table)};
    connection.onInterrupted=()=>{if(connections.get(table)===connection)holdFrame(table)};
    connection.onResumed=()=>{connection.lastFrame=Date.now();connection.video?.play().catch(()=>{})};
    connection.onClose=()=>{clearInterval(connection.timer);if(connecting.get(table)===connection)connecting.delete(table);if(connections.get(table)===connection){connections.delete(table);const video=remote.get(table);if(video)video.dataset.reconnecting='true';announce()}discardStaged(table,connection)};
    await connection.start();if(connection.closed)throw Error('La connexió de vídeo s’ha interromput');
    if(!allowed(table)||pending.get(table)!==token){connection.close();return}connections.set(table,connection);if(connecting.get(table)===connection)connecting.delete(table);
    let lastTime=-1,lastDecoded=-1,checking=false;connection.lastFrame=Date.now();
    connection.timer=setInterval(async()=>{
     const focused=Number(document.body.dataset?.fullTable);if(document.hidden||focused&&focused!==table||checking||connection.closed)return;
     const video=remote.get(table);if(video?.paused&&video.videoWidth>0&&video.dataset.reconnecting!=='true')return;checking=true;
     try{
      let available=false,advanced=false,decoded=0;
      if(connection.pc?.getStats){const stats=await connection.pc.getStats();stats.forEach(r=>{if(r.type==='inbound-rtp'&&(r.kind==='video'||r.mediaType==='video')&&Number.isFinite(r.framesDecoded)){available=true;decoded+=r.framesDecoded}})}
      connection.usesDecodedStats=available;
      if(available){advanced=decoded>lastDecoded;lastDecoded=decoded}else if(video&&video.readyState>=2&&video.videoWidth){advanced=video.currentTime!==lastTime;lastTime=video.currentTime}
      if(advanced){connection.lastFrame=Date.now();if(video&&connection.video===video){if(frozen.has(table)){clearFrame(table);announce()}rememberFrame(table,video)}}
      const stalled=Date.now()-connection.lastFrame;if(stalled>6000)holdFrame(table);if(stalled>15000)connection.close();
     }catch{}finally{checking=false}
    },2000);
   }catch(error){connection?.close();discardStaged(table,connection);if(pending.get(table)===token){const el=document.querySelector('#tvLiveStatus'+table);if(el)el.textContent=error.message||'Esperant vídeo · Reconnexió automàtica'}}finally{if(pending.get(table)===token)pending.delete(table);if(connecting.get(table)===connection)connecting.delete(table)}
  }
  function removeFeed(table){pending.delete(table);connecting.get(table)?.close();connections.get(table)?.close();connecting.delete(table);connections.delete(table);discardStaged(table);clearFrame(table);lastFrames.delete(table);const old=remote.get(table);if(old){old.pause();old.srcObject=null;old.remove();remote.delete(table)}}
  function sync(){for(const table of[1,2]){if(!allowed(table)){removeFeed(table);continue}connect(table)}}
  function resume(){for(const connection of connections.values()){connection.lastFrame=Date.now();connection.video?.play().catch(()=>{})}sync()}
  window.addEventListener('cpool-broadcast-access',sync);window.addEventListener('cpool-dvr-change',sync);window.addEventListener('cpool-tv-screen-change',resume);setInterval(sync,1500);sync();
  window.addEventListener('offline',()=>{for(const table of connections.keys())holdFrame(table)});
  window.addEventListener('online',()=>{for(const connection of connecting.values())connection.close();resume()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume()});
  window.addEventListener('pagehide',()=>{leaving=true;for(const table of[1,2])removeFeed(table)});window.addEventListener('pageshow',()=>{leaving=false;resume()});
 }
})();
