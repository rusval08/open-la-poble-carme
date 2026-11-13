(function(){
 'use strict';if(!document.body.classList.contains('admin-body'))return;
 window.CPoolSimpleCameras=true;document.body.classList.add('simple-camera-admin');
 let verified=false;const preparing=new Map(),prepared=new Map();
 const style=document.createElement('style');style.textContent=`
 .simple-camera-admin .dvr-admin,.simple-camera-admin #youtubeAdminPanel,.simple-camera-admin #admin-tv>.admin-workspace-heading{display:none!important}
 .simple-camera-admin .broadcast-gate-panel>.broadcast-preview-link,.simple-camera-admin .broadcast-gate-panel>p:not(.broadcast-gate-message),.simple-camera-admin .broadcast-gate-panel .eyebrow{display:none!important}
 .simple-camera-admin .production-camera>:not(.production-camera-header):not(.production-preview):not(.tv-usb-panel):not(.live-broadcast-controls){display:none!important}
 .simple-camera-admin .production-preview-tools,.simple-camera-admin .tv-usb-panel>summary,.simple-camera-admin .tv-usb-stop,.simple-camera-admin .tv-usb-note,.simple-camera-admin .production-on-air,.simple-camera-admin .production-heading a,.simple-camera-admin .production-heading p,.simple-camera-admin .live-broadcast-controls>button,.simple-camera-admin .live-broadcast-controls>.production-note{display:none!important}
 .simple-camera-admin .production-heading h2{font-size:18px}.simple-camera-admin .production-camera{border-radius:0}.simple-camera-admin .tv-usb-panel{display:block!important}.simple-camera-admin .tv-usb-controls{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.simple-camera-admin .tv-usb-start{min-height:40px;border-radius:0}
 `;document.head.append(style);
 function note(table,text){const card=document.querySelector('.production-camera[data-table="'+table+'"]');const status=card?.querySelector('.live-broadcast-status');if(status)status.textContent=text}
 async function start(table){
  const stream=window.AdminCameraPreview?.stream(table);
  if(!verified||!window.CPoolCameraBroadcast||!stream?.getVideoTracks().some(t=>t.readyState==='live'))return;
  if(preparing.has(table)||window.CPoolCameraBroadcast.wanted(table))return;
  const job={};preparing.set(table,job);const current=()=>window.AdminCameraPreview?.stream(table)===stream&&stream.getVideoTracks().some(t=>t.readyState==='live');
  try{
   if(prepared.get(table)!==stream){
    const r=await fetch('/api/production',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table,patch:{dvr:false,mode:'live',autoFinish:false}})}),data=await r.json();
    if(!r.ok)throw Error(data.error||'No es pot preparar la càmera per al públic');
    if(!current())return;
    if(!current())return;prepared.set(table,stream);
   }
   if(current())window.CPoolCameraBroadcast.start(table);
  }catch(error){note(table,error.message)}finally{if(preparing.get(table)===job){preparing.delete(table);if(window.AdminCameraPreview?.stream(table)!==stream)start(table)}}
 }
 function gate(next){
  if(typeof next?.open!=='boolean')return;
  verified=true;for(const table of [1,2])start(table);
 }
 window.addEventListener('cpool-admin-public-gate',event=>gate(event.detail));
 window.addEventListener('cpool-preview-stopped',event=>prepared.delete(Number(event.detail.table)));
 window.addEventListener('cpool-preview-ready',event=>{const table=Number(event.detail.table);if([1,2].includes(table)){prepared.delete(table);start(table)}});
 function mount(){
  const host=document.querySelector('#admin-tv'),gatePanel=document.querySelector('.broadcast-gate-panel');
  if(host&&gatePanel&&gatePanel.parentElement!==host)host.prepend(gatePanel);
  for(const panel of document.querySelectorAll('.tv-usb-panel')){if(!panel.open)panel.open=true}
  const title=document.querySelector('.production-heading h2');if(title&&title.textContent!=='Càmeres de les dues TV Table')title.textContent='Càmeres de les dues TV Table';
 }
 const observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});mount();
 fetch('/api/broadcast-visibility',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data?.adminPreview===true)gate(data)}).catch(()=>{});
})();
